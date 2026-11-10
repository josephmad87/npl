import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const source = await readFile(new URL('../src/lib/supporterApi.ts', import.meta.url), 'utf8')
function setup(fetch) {
  const data = new Map()
  const window = new EventTarget()
  window.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) }
  let resets = 0
  window.addEventListener('npl-supporter-session-reset', () => { resets++ })
  const module = { exports: {} }
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { module, exports: module.exports, window, CustomEvent, Headers, fetch, require: name => name === 'react' ? { useSyncExternalStore() {} } : name === './publicApi' ? { getApiBaseUrl: () => 'https://api.test' } : { supporterApiMessage: (_p, fallback) => fallback } })
  return { api: module.exports, data, resets: () => resets }
}
const ok = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } })
const tokens = label => ({ access_token: `access-${label}`, refresh_token: `refresh-${label}` })
test('sign-in and sign-out reset account cache and remove local consent identifiers', async () => {
  const s = setup(async () => ok(tokens('A')))
  await s.api.supporterLogin('a@example.com', 'password')
  assert.equal(s.resets(), 1)
  s.data.set('npl_supporter_analytics_consent', 'true')
  s.data.set('npl_consent_analytics_id', 'old-id')
  s.api.setSupporterSession(null)
  assert.equal(s.resets(), 2)
  assert.equal(s.data.size, 0)
})
test('late token refresh cannot restore a signed-out account over the next user', async () => {
  let finishRefresh, started = false
  const s = setup(async (url, init) => {
    if (url.endsWith('/auth/login')) return ok(tokens(JSON.parse(init.body).email))
    if (url.endsWith('/auth/refresh')) { started = true; return new Promise(resolve => { finishRefresh = resolve }) }
    return new Response('{}', { status: 401 })
  })
  await s.api.supporterLogin('A', 'password')
  const pending = s.api.supporterFetch('/supporters/me')
  const rejected = assert.rejects(pending, /session changed/)
  while (!started) await new Promise(resolve => setTimeout(resolve, 1))
  s.api.setSupporterSession(null)
  await s.api.supporterLogin('B', 'password')
  finishRefresh(ok(tokens('A-new')))
  await rejected
  assert.equal(JSON.parse(s.data.get('npl_supporter_session_v1')).accessToken, 'access-B')
})
test('concurrent expired requests share one refresh without clearing the same account cache', async () => {
  let refreshes = 0
  const s = setup(async (url, init) => {
    if (url.endsWith('/auth/login')) return ok(tokens('expired'))
    if (url.endsWith('/auth/refresh')) { refreshes++; return ok(tokens('new')) }
    return init.headers.get('Authorization') === 'Bearer access-new' ? ok({ success: true }) : new Response('{}', { status: 401 })
  })
  await s.api.supporterLogin('A', 'password')
  const results = await Promise.all([s.api.supporterFetch('/supporters/me'), s.api.supporterFetch('/supporters/follows')])
  assert.equal(results.every(r => r.success), true)
  assert.equal(refreshes, 1)
  assert.equal(s.resets(), 1)
})
