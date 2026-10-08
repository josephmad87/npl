import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

const source = await readFile(new URL('../src/lib/supporterValidation.ts', import.meta.url), 'utf8')
const moduleUrl = `data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`
const { validateSupporterAuth, supporterApiMessage } = await import(moduleUrl)
const valid = {
  email: 'supporter@example.com',
  password: 'a'.repeat(12),
  display_name: 'NPL Supporter',
  phone: '+263771234567',
  accept_terms: true,
  accept_privacy: true,
}

for (const length of [0, 1, 8, 11]) {
  test(`registration rejects a ${length}-character password with an explanation`, () => {
    assert.match(validateSupporterAuth('register', { ...valid, password: 'a'.repeat(length) }).password, /at least 12/)
  })
}

for (const length of [12, 128]) {
  test(`registration accepts a ${length}-character password without optional consents`, () => {
    assert.deepEqual(validateSupporterAuth('register', { ...valid, password: 'a'.repeat(length) }), {})
  })
}

test('registration rejects passwords beyond the server maximum', () => {
  assert.match(validateSupporterAuth('register', { ...valid, password: 'a'.repeat(129) }).password, /no more than 128/)
})

test('password characters match Python rather than UTF-16 length and are never trimmed', () => {
  assert.match(validateSupporterAuth('register', { ...valid, password: '🏏'.repeat(6) }).password, /at least 12/)
  assert.deepEqual(validateSupporterAuth('register', { ...valid, password: '🏏'.repeat(12) }), {})
  assert.deepEqual(validateSupporterAuth('register', { ...valid, password: ' abcdefghij ' }), {})
})

test('registration validates trimmed display names and phone length', () => {
  for (const display_name of ['', '   ', 'a'.repeat(256)]) {
    assert.ok(validateSupporterAuth('register', { ...valid, display_name }).display_name)
  }
  for (const phone of ['', '       ', ' 123456 ', '1'.repeat(33)]) {
    assert.ok(validateSupporterAuth('register', { ...valid, phone }).phone)
  }
  for (const phone of ['1234567', '1'.repeat(32), ' +263 77 123 4567 ']) {
    assert.deepEqual(validateSupporterAuth('register', { ...valid, phone }), {})
  }
  assert.deepEqual(validateSupporterAuth('register', { ...valid, display_name: 'a'.repeat(255) }), {})
})

test('registration checks email format and maximum length', () => {
  for (const email of ['', 'invalid', 'a@@b', 'a b@example.com', `${'a'.repeat(244)}@example.com`]) {
    assert.ok(validateSupporterAuth('register', { ...valid, email }).email)
  }
  for (const email of [' supporter@example.com ', `${'a'.repeat(243)}@example.com`, 'fan+news@example.com']) {
    assert.deepEqual(validateSupporterAuth('register', { ...valid, email }), {})
  }
})

test('both required consents must be checked independently', () => {
  for (const field of ['accept_terms', 'accept_privacy']) {
    assert.ok(validateSupporterAuth('register', { ...valid, [field]: false })[field])
  }
})

test('sign-in retains its existing rules, without registration-only fields', () => {
  const fields = { ...valid, password: 'short', display_name: '', phone: '', accept_terms: false, accept_privacy: false }
  assert.deepEqual(validateSupporterAuth('login', fields), {})
  assert.equal(validateSupporterAuth('login', { ...fields, password: '' }).password, 'Enter your password.')
})

test('FastAPI 422 details produce labelled errors without echoing credentials or input', () => {
  const message = supporterApiMessage({ detail: [
    { loc: ['body', 'password'], msg: 'String should have at least 12 characters', input: 'secret-password', ctx: { min_length: 12 } },
    { loc: ['body', 'phone'], msg: 'String should have at least 7 characters', input: 'secret-phone' },
  ] }, 'Request failed: 422')
  assert.equal(message, 'Password: String should have at least 12 characters Phone number: String should have at least 7 characters')
  assert.doesNotMatch(message, /secret-password|secret-phone|Request failed/)
})

test('body-level consent errors and unknown fields remain understandable', () => {
  assert.equal(supporterApiMessage({ detail: [{ loc: ['body'], msg: 'Value error, The Terms and Privacy Policy must be accepted.' }] }, 'fallback'), 'The Terms and Privacy Policy must be accepted.')
  assert.equal(supporterApiMessage({ detail: [{ loc: ['body', 'new_field'], msg: 'Field required' }] }, 'fallback'), 'new field: Field required')
})

test('duplicate-email and sign-in error formats are preserved', () => {
  assert.equal(supporterApiMessage({ detail: { code: 'email_in_use', message: 'A supporter account already uses this email.' } }, 'fallback'), 'A supporter account already uses this email.')
  assert.equal(supporterApiMessage({ detail: 'Incorrect email or password.' }, 'fallback'), 'Incorrect email or password.')
})

test('malformed or empty response details fall back safely', () => {
  for (const payload of [null, 'not-json', [], {}, { detail: [] }, { detail: '' }, { detail: { message: {} } }, { detail: [null, {}, 'bad', { msg: 123 }, { msg: ' ' }] }]) {
    assert.equal(supporterApiMessage(payload, 'Request failed: 422'), 'Request failed: 422')
  }
})

test('duplicate validation messages are shown only once', () => {
  const error = { loc: ['body', 'email'], msg: 'Field required' }
  assert.equal(supporterApiMessage({ detail: [error, error] }, 'fallback'), 'Email address: Field required')
})

test('the account form validates before a request and supports accessible submission', async () => {
  const page = await readFile(new URL('../src/SupporterAccountPage.tsx', import.meta.url), 'utf8')
  const api = await readFile(new URL('../src/lib/supporterApi.ts', import.meta.url), 'utf8')
  assert.ok(page.indexOf('validateSupporterAuth(mode, fields)') < page.indexOf('await supporterRegister('))
  assert.match(page, /if \(firstInvalidField\)[\s\S]*?return[\s\S]*?setBusy\(true\)/)
  assert.match(page, /<form[^>]*noValidate[^>]*onSubmit=/)
  assert.match(page, /type="submit"/)
  assert.match(page, /id="supporter-password-help"/)
  assert.match(page, /'aria-invalid': Boolean\(fieldErrors\[field\]\)/)
  assert.match(api, /supporterApiMessage as apiMessage/)
  assert.match(api, /apiMessage\(payload, `Request failed: \$\{response.status\}`\)/)
})
