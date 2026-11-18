import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FruitTracker } from '../src/fruit-tracker.ts'

const workers = []
class WorkerStub {
  constructor(url) { this.url = String(url); workers.push(this) }
  postMessage(message, transfer) { this.message = message; this.transfer = transfer; if (message.type === 'init') queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } })) }
  terminate() { this.terminated = true }
}
globalThis.Worker = WorkerStub
globalThis.OffscreenCanvas = class {}
globalThis.createImageBitmap = async () => ({ close() {} })
test('tracking sends a transferable frame to the worker and returns its landmarks', async () => {
  const tracker = new FruitTracker(); await tracker.init('https://example.test/mediapipe')
  const worker = workers.at(-1), pending = tracker.sample({}, 123, true)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(worker.message.type, 'frame'); assert.equal(worker.message.withFace, true)
  assert.equal(worker.transfer[0], worker.message.bitmap)
  const sample = { timestamp: 123, landmarks: [{ x: .5, y: .5, z: 0 }], world: [] }
  worker.onmessage({ data: { type: 'sample', sample } })
  assert.deepEqual(await pending, sample)
  tracker.close(); assert.equal(worker.terminated, true)
})
test('leaving during inference cancels the pending request and terminates its worker', async () => {
  const tracker = new FruitTracker(); await tracker.init('/mediapipe')
  const pending = tracker.sample({}, 200, false)
  const rejected = assert.rejects(pending, /closed/)
  await new Promise(resolve => setImmediate(resolve)); tracker.close(); await rejected
  assert.equal(workers.at(-1).terminated, true)
})
test('leaving during frame capture closes the bitmap instead of posting it', async () => {
  const tracker = new FruitTracker(); await tracker.init('/mediapipe')
  let finish, closes = 0
  globalThis.createImageBitmap = () => new Promise(resolve => { finish = resolve })
  const pending = tracker.sample({}, 300, false), rejected = assert.rejects(pending, /closed/)
  tracker.close(); finish({ close() { closes++ } }); await rejected
  assert.equal(closes, 1)
})

test('Snow uses its own three-model tracking worker and closes it on exit', async () => {
  const tracker = new FruitTracker('snow'); await tracker.init('https://example.test/mediapipe')
  const worker = workers.at(-1)
  assert.match(worker.url, /snow-tracker\.worker/)
  tracker.close(); assert.equal(worker.terminated, true)
})

test('the choir selects its two-hand worker instead of loading face or segmentation models', async () => {
  const tracker = new FruitTracker('choir'); await tracker.init('https://example.test/mediapipe')
  const worker = workers.at(-1)
  assert.match(worker.url, /choir-tracker\.worker/)
  tracker.close(); assert.equal(worker.terminated, true)
})
