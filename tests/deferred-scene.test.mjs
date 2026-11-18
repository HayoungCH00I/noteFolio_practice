import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deferredScene } from '../src/deferred-scene.ts'
globalThis.document = { createElement: () => ({ remove() {} }) }
test('3D loading is deferred, happens only once and respects navigation during loading', async () => {
  let loads = 0, finish
  const states = [], scene = { setActive: active => states.push(active) }
  const root = { append() {} }
  const page = deferredScene(root, () => { loads++; return new Promise(resolve => { finish = resolve }) })
  page.setActive(false); assert.equal(loads, 0)
  page.setActive(true); page.setActive(true); assert.equal(loads, 1)
  page.setActive(false); finish(scene); await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(states, [false])
  page.setActive(true); assert.equal(loads, 1); assert.deepEqual(states, [false, true])
})
test('a failed download can be retried when the page is reopened', async () => {
  let attempts = 0
  const page = deferredScene({ append() {} }, async () => { attempts++; if (attempts === 1) throw new Error('offline'); return { setActive() {} } })
  page.setActive(true); await new Promise(resolve => setImmediate(resolve))
  page.setActive(false); page.setActive(true); await new Promise(resolve => setImmediate(resolve))
  assert.equal(attempts, 2)
})
