import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ChoirScene } from '../src/choir.ts'
import { ChoirScoldPrompt } from '../src/choir-scold-prompt.ts'
import { FruitTracker } from '../src/fruit-tracker.ts'

globalThis.ResizeObserver = class { observe() {} }
globalThis.cancelAnimationFrame = () => {}
globalThis.requestAnimationFrame = () => 1
globalThis.document = { hidden: false, addEventListener() {} }
globalThis.location = { href: 'https://example.test/' }
function scene() {
  const nodes = new Map()
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { addEventListener() {}, setAttribute() {}, style: {}, hidden: false, textContent: '', disabled: false })
    return nodes.get(selector)
  }
  const video = { srcObject: null, async play() {}, pause() {}, readyState: 2, currentTime: 1 }
  const root = { querySelector: selector => selector === 'video' ? video : get(selector), querySelectorAll: () => [], dataset: {} }
  const choir = new ChoirScene(root); choir.active = true
  return { choir, video, get }
}
function requestCamera(getUserMedia, secure = true) {
  globalThis.window = { isSecureContext: secure }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia } } })
}
test('an insecure connection explains the camera requirement without requesting permission', async () => {
  let requests = 0; requestCamera(() => { requests++ }, false)
  const { choir, get } = scene(); await choir.startCamera()
  assert.equal(requests, 0); assert.match(get('.choir-cue').textContent, /HTTPS/)
})
test('denying permission leaves the choir camera button available for retry', async t => {
  const original = console.error; console.error = () => {}; t.after(() => { console.error = original })
  requestCamera(async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }) })
  const { choir, get } = scene(); await choir.startCamera()
  assert.equal(choir.loading, false); assert.equal(get('.choir-camera-toggle').disabled, false)
  assert.match(get('.choir-cue').textContent, /권한/)
})
test('a camera in use reports a camera problem instead of a hand-tracking problem', async t => {
  const original = console.error; console.error = () => {}; t.after(() => { console.error = original })
  requestCamera(async () => { throw Object.assign(new Error('device busy'), { name: 'NotReadableError' }) })
  const { choir, get } = scene(); await choir.startCamera()
  assert.match(get('.choir-cue').textContent, /다른 앱/); assert.doesNotMatch(get('.choir-cue').textContent, /손 인식/)
})
test('failed tracking keeps the preview running, disables the game, and can retry without requesting the camera again', async t => {
  const originalInit = FruitTracker.prototype.init, originalError = console.error
  let attempts = 0, requests = 0, stops = 0
  FruitTracker.prototype.init = async function () { if (++attempts === 1) throw new Error('WebGL context unavailable') }
  console.error = () => {}; t.after(() => { FruitTracker.prototype.init = originalInit; console.error = originalError })
  const track = { stop() { stops++ }, addEventListener() {} }, camera = { getTracks: () => [track], getVideoTracks: () => [track] }
  requestCamera(async () => { requests++; return camera })
  const { choir, video, get } = scene(); await choir.startCamera()
  assert.equal(stops, 0); assert.equal(video.srcObject, camera); assert.equal(choir.trackingReady, false)
  assert.equal(get('.choir-tracking-retry').hidden, false); assert.match(get('.choir-cue').textContent, /그래픽 기능/)
  await choir.prepareTracking(choir.generation)
  assert.equal(choir.trackingReady, true); assert.equal(requests, 1); assert.equal(get('.choir-tracking-retry').hidden, true)
  choir.setActive(false); assert.equal(stops, 1)
})
test('camera permission granted after leaving cannot keep the camera running', async () => {
  let grant, stops = 0; requestCamera(() => new Promise(resolve => { grant = resolve }))
  const { choir, video } = scene(), pending = choir.startCamera()
  choir.setActive(false); grant({ getTracks: () => [{ stop() { stops++ } }] }); await pending
  assert.equal(stops, 1); assert.equal(video.srcObject, null)
})
test('leaving releases camera, tracking and music; a late hand sample is ignored', async () => {
  const { choir, video } = scene(); let finish, calls = 0, stops = 0, closes = 0
  choir.stream = { getTracks: () => [{ stop() { stops++ } }] }; video.srcObject = choir.stream
  choir.tracker = { sample() { calls++; return new Promise(resolve => { finish = resolve }) }, close() { closes++ } }
  choir.music = { setPlaying() {}, close() { closes++ } }
  const pending = choir.sampleHands(1000); await choir.sampleHands(1100)
  assert.equal(calls, 1)
  choir.setActive(false)
  finish({ hands: [Array(21).fill({ x: .3, y: .5 }), Array(21).fill({ x: .7, y: .5 })] }); await pending
  assert.equal(stops, 1); assert.equal(closes, 2); assert.equal(video.srcObject, null)
  assert.equal(choir.controls.hasHands, false); assert.equal(choir.busy, false)
})
test('the live scene connects each rating to the correct singer expression and moves the pitch indicator vertically', () => {
  const { choir, get } = scene(), now = performance.now(); let good
  choir.started = true; choir.stream = {}; choir.trackingReady = true; choir.sequence.motion = 'vertical'
  choir.stage = { update(_dt, _now, _phase, _singing, harmonious) { good = harmonious } }
  choir.music = { playing: true, ready: true, rate: 1, position: 18, setRate(value) { this.rate = value }, setPitch() {}, setPlaying() {} }
  choir.controls.hands([{ x: .5, y: .5 }, { x: .5, y: .5 }], now, false)
  choir.controls.harmony = .1; choir.tick(now)
  assert.equal(get('.choir-quality strong').textContent, 'BAD'); assert.equal(good, false)
  choir.controls.harmony = 1; choir.tick(now + 16)
  assert.equal(get('.choir-quality strong').textContent, 'EXCELLENT!'); assert.equal(good, true)
  assert.match(get('.choir-pitch i').style.bottom, /%$/)
})
test('the scene replaces the central motion cue on pause and countdown, then restores it on resume', () => {
  const { choir, get } = scene(), now = performance.now()
  choir.started = true; choir.stream = {}; choir.trackingReady = true; choir.music = { ready: true, playing: true }; choir.sequence.motion = 'vertical'
  choir.controls.hasHands = true; choir.updateInstruction(now)
  assert.match(get('.choir-cue').textContent, /다섯 손가락/); assert.equal(get('.choir-guide-hands').hidden, false)
  choir.controls.hasHands = false; choir.updateInstruction(now)
  assert.equal(get('.choir-cue').textContent, '노래를 잠시 멈췄어요.'); assert.equal(get('.choir-guide-hands').hidden, true)
  choir.gestures.paused = true; choir.gestures.resumeAt = now + 3000; choir.updateInstruction(now)
  assert.equal(get('.choir-countdown').hidden, false); assert.equal(get('.choir-countdown strong').textContent, '3')
  assert.doesNotMatch(get('.choir-cue').textContent, /다섯 손가락|멈췄/)
  choir.controls.hasHands = true; choir.gestures.paused = false; choir.gestures.resumeAt = 0; choir.updateInstruction(now)
  assert.match(get('.choir-cue').textContent, /다섯 손가락/); assert.equal(get('.choir-countdown').hidden, true)
})
function poorPerformance() {
  const fixture = scene(), { choir } = fixture
  choir.started = true; choir.stream = {}; choir.trackingReady = true; choir.sequence.motion = 'vertical'
  choir.scoldPrompt = new ChoirScoldPrompt(() => .6)
  choir.controls.hasHands = true; choir.controls.harmony = .1; choir.controls.advance = () => {}
  const frames = []; choir.stage = { update(...args) { frames.push(args) } }
  choir.music = { playing: true, ready: true, rate: .75, position: 30, setRate() {}, setPitch() {}, setPlaying() {} }
  const begin = performance.now()
  for (let i = 0; i <= 62; i++) choir.tick(begin + i * 50)
  return { ...fixture, frames, now: begin + 3100 }
}
test('the game invites scolding before an index pose, highlights its target, and restores conducting immediately on success', () => {
  const { choir, get, frames, now } = poorPerformance()
  assert.equal(choir.pointing, false); assert.equal(choir.scoldPrompt.target, 2)
  assert.match(get('.choir-cue').textContent, /3번.*혼내세요/); assert.equal(frames.at(-1)[7], 2)
  assert.equal(get('.choir-help-action').textContent, '혼내기')
  const sequenceTime = choir.sequence.elapsed; choir.tick(now + 50); assert.equal(choir.sequence.elapsed, sequenceTime)
  choir.gestures.scolded = 2; choir.gestures.scoldUntil = now + 5000; choir.tick(now + 100)
  assert.equal(choir.scoldPrompt.active, false); assert.match(get('.choir-cue').textContent, /다섯 손가락/)
  assert.equal(frames.at(-1)[6], 2); assert.equal(frames.at(-1)[7], -1)
})
test('pausing the game removes both the invitation and its target outline', () => {
  const { choir, get, frames, now } = poorPerformance()
  choir.gestures.paused = true; choir.tick(now + 50)
  assert.equal(choir.scoldPrompt.active, false); assert.equal(get('.choir-cue').textContent, '노래를 잠시 멈췄어요.')
  assert.equal(frames.at(-1)[7], -1); assert.equal(get('.choir-guide-hands').hidden, true)
})
