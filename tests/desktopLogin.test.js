import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDesktopRequest, desktopSessionPayload } from '../src/lib/desktopLogin.js'
const state = 'a'.repeat(43)
const query = callback => new URLSearchParams({ callback, state }).toString()
test('only loopback callback with an unpredictable state is accepted', () => {
  assert.equal(parseDesktopRequest(query('http://127.0.0.1:54321/callback')).state, state)
  for (const url of ['https://evil.test/callback','http://127.0.0.1.evil.test:54321/callback',
    'http://user@127.0.0.1:54321/callback','http://127.0.0.1:54321/callback?redirect=evil',
    'http://127.0.0.1:80/callback','http://localhost:54321/callback']) {
    assert.throws(() => parseDesktopRequest(query(url)))
  }
  assert.throws(() => parseDesktopRequest('?callback=http://127.0.0.1:54321/callback&state=short'))
})
test('handoff excludes user metadata and validates required credentials', () => {
  assert.throws(() => desktopSessionPayload({}))
  assert.deepEqual(JSON.parse(desktopSessionPayload({ access_token:'test',refresh_token:'refresh',expires_at:10,user:{id:'ignored'} })),
    {access_token:'test',refresh_token:'refresh',expires_at:10})
})
