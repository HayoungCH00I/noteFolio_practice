import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FruitSlash } from '../src/fruit-slash.ts'

globalThis.ResizeObserver = class { observe() {} }
globalThis.cancelAnimationFrame = () => {}
globalThis.requestAnimationFrame = () => 1
globalThis.document = { hidden: false, addEventListener() {} }
const elements = () => {
  const nodes = new Map()
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { addEventListener() {}, classList: { toggle() {} }, style: {}, hidden: false, textContent: '', disabled: false })
    return nodes.get(selector)
  }
  const video = { srcObject: null, async play() {}, pause() {} }
  const canvas = { getContext: () => ({}) }
  const root = { classList: { toggle() {} }, querySelector: selector => selector === 'video' ? video : selector === 'canvas' ? canvas : get(selector), querySelectorAll: () => [get('.fruit-start'), get('.fruit-again')] }
  const game = new FruitSlash(root); game.active = true; game.width = 800; game.height = 600
  return { game, get, video }
}
function cameraRequest(getUserMedia, secure = true) {
  globalThis.window = { isSecureContext: secure }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia } } })
}
function stream() {
  const track = { stops: 0, stop() { this.stops++ }, addEventListener() {} }
  return { track, getTracks: () => [track], getVideoTracks: () => [track] }
}
test('insecure HTTP shows camera guidance without requesting the device', async () => {
  let requests = 0; cameraRequest(() => { requests++; return Promise.resolve(stream()) }, false)
  const { game, get } = elements(); await game.start()
  assert.equal(requests, 0); assert.match(get('.fruit-message').textContent, /HTTPS/)
})
test('denied camera permission leaves a retryable start screen', async () => {
  cameraRequest(async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }) })
  const { game, get } = elements(); await game.start()
  assert.match(get('.fruit-message').textContent, /권한/); assert.equal(game.loading, false); assert.equal(game.game.running, false)
})
test('late camera permission after leaving the page cannot leak an active camera', async () => {
  let grant; cameraRequest(() => new Promise(resolve => { grant = resolve }))
  const { game, video } = elements(), camera = stream()
  const pending = game.start(); game.stop(); grant(camera); await pending
  assert.equal(camera.track.stops, 1); assert.equal(video.srcObject, null); assert.equal(game.readyAt, 0)
})
test('starting uses only video and leaving the page releases camera and tracking models', async () => {
  const camera = stream(); let constraints, closed = 0
  cameraRequest(async value => { constraints = value; return camera })
  const { game, video } = elements()
  game.tracker = { close() { closed += 2 } }
  await game.start()
  assert.equal(constraints.audio, false); assert.equal(video.srcObject, camera); assert.ok(game.readyAt > 0)
  game.setActive(false)
  assert.equal(camera.track.stops, 1); assert.equal(video.srcObject, null); assert.equal(closed, 2); assert.equal(game.game.running, false)
})

function poseSample(pose, timestamp) {
  const p = Array.from({ length: 21 }, () => ({ x: .5, y: .6, z: 0 }))
  p[0] = { x: .5, y: .9 }; p[5] = { x: .35, y: .6 }; p[6] = { x: .35, y: .35 }; p[8] = { x: .35, y: -.1 }; p[4] = { x: .5, y: .57 }
  for (const [mcp, pip, tip, x] of [[9, 10, 12, .5], [13, 14, 16, .65], [17, 18, 20, .75]]) { p[mcp] = { x, y: .6 }; p[pip] = { x, y: .4 }; p[tip] = { x: x + .03, y: .65 } }
  if (pose === 'fist') p[8] = { x: .4, y: .65 }
  if (pose === 'open') { for (const [mcp, pip, tip] of [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]]) { p[pip] = { x: p[mcp].x, y: .35 }; p[tip] = { x: p[mcp].x, y: -.1 } }; p[4] = { x: -.15, y: .35 } }
  return { timestamp, landmarks: p, world: p }
}
test('open palm pauses; fist starts a three-second countdown and resumes without restarting', () => {
  const { game, get } = elements()
  game.game.start(0); game.game.score = 7; game.game.combo = 4
  game.game.object = { kind: 'apple', x: 100, y: 100, vy: 0, vx: 0, radius: 30, angle: 0, spin: 0 }
  const object = game.game.object
  game.processSample(poseSample('open', 1000), 1000)
  assert.equal(game.game.paused, false, 'brief recognition must not pause accidentally')
  game.processSample(poseSample('open', 1160), 1160)
  assert.equal(game.game.paused, true); assert.equal(get('.fruit-paused').hidden, false)
  const remaining = game.game.remaining(1160)
  game.processSample(poseSample('fist', 2000), 2000); game.processSample(poseSample('fist', 2160), 2160)
  assert.equal(game.resumeAt, 5160)
  game.render = () => {}; game.tick(5150); assert.equal(game.game.paused, true)
  game.tick(5160); assert.equal(game.game.paused, false); assert.equal(get('.fruit-paused').hidden, true)
  assert.equal(game.game.score, 7); assert.equal(game.game.combo, 4); assert.equal(game.game.object, object)
  assert.equal(game.game.remaining(5160), remaining)
})
test('showing an open hand during the resume countdown cancels it', () => {
  const { game } = elements(); game.game.start(0); game.pause(1000)
  game.processSample(poseSample('fist', 2000), 2000); game.processSample(poseSample('fist', 2160), 2160)
  assert.ok(game.resumeAt)
  game.processSample(poseSample('open', 2300), 2300); game.processSample(poseSample('open', 2460), 2460)
  assert.equal(game.resumeAt, 0); assert.equal(game.game.paused, true)
})
test('tracking skips additional frames while one inference is in flight', async () => {
  const { game, video } = elements(); let complete, calls = 0
  video.readyState = 2; video.currentTime = 1; game.stream = stream(); game.game.start(0)
  game.tracker = { sample() { calls++; return new Promise(resolve => { complete = resolve }) } }
  const pending = game.track(1000); video.currentTime = 2; await game.track(1100)
  assert.equal(calls, 1)
  complete({ timestamp: 1000, landmarks: [], world: [] }); await pending
  assert.equal(game.frameBusy, false)
})
