import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'

const source = await readFile(new URL('../src/lib/scheduled-publication-time.ts', import.meta.url), 'utf8')
const {
  validateZimbabwePublicationTime,
  zimbabwePublicationInput,
  zimbabwePublicationTimeForApi,
} = await import(
  `data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`
)

test('scheduled story times use Zimbabwe time regardless of browser timezone', () => {
  assert.deepEqual(zimbabwePublicationInput('2026-10-13T09:45:00Z'), {
    date: '2026-10-13',
    time: '11:45',
  })
  assert.equal(
    zimbabwePublicationTimeForApi('2026-10-13', '11:45'),
    '2026-10-13T11:45:00+02:00',
  )
  assert.equal(
    new Date(zimbabwePublicationTimeForApi('2026-10-13', '11:45')).toISOString(),
    '2026-10-13T09:45:00.000Z',
  )
})

test('invalid calendar dates and clock times cannot be scheduled', () => {
  assert.equal(zimbabwePublicationTimeForApi('2026-02-30', '09:00'), null)
  assert.equal(zimbabwePublicationTimeForApi('2026-10-13', '24:00'), null)
  assert.equal(zimbabwePublicationTimeForApi('', '09:00'), null)
})

test('a scheduled story requires both fields and a strictly future time', () => {
  const due = Date.parse('2026-10-13T09:45:00Z')
  assert.match(validateZimbabwePublicationTime('2026-10-13', '', due - 1).error, /both/)
  assert.match(validateZimbabwePublicationTime('2026-02-30', '09:00', due - 1).error, /valid/)
  assert.deepEqual(validateZimbabwePublicationTime('2026-10-13', '11:45', due - 1), {
    publishedAt: '2026-10-13T11:45:00+02:00',
    error: null,
  })
  assert.match(validateZimbabwePublicationTime('2026-10-13', '11:45', due).error, /future/)
  assert.match(validateZimbabwePublicationTime('2026-10-13', '11:45', due + 1).error, /future/)
})
