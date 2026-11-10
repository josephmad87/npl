import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'vite'

test('public reads bound waiting time and retain HTTP failure handling', async () => {
  const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' })
  const originalFetch = globalThis.fetch
  const originalTimeout = AbortSignal.timeout
  const signal = new AbortController().signal
  try {
    let deadline
    AbortSignal.timeout = milliseconds => { deadline = milliseconds; return signal }
    const { fetchJson } = await server.ssrLoadModule('/src/lib/publicApi.ts')
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.signal, signal)
      return new Response(JSON.stringify({ score: 42 }), { status: 200 })
    }
    assert.deepEqual(await fetchJson('/public/test'), { score: 42 })
    assert.equal(deadline, 15_000)
    globalThis.fetch = async () => new Response('', { status: 503 })
    await assert.rejects(fetchJson('/public/test'), /503/)
    globalThis.fetch = async () => { throw new DOMException('Timed out', 'TimeoutError') }
    await assert.rejects(fetchJson('/public/test'), { name: 'TimeoutError' })
  } finally {
    globalThis.fetch = originalFetch
    AbortSignal.timeout = originalTimeout
    await server.close()
  }
})
