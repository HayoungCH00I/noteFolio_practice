import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SnowFog } from '../src/snow-fog.ts'
import { SnowScene } from '../src/snow.ts'
import { detectSnowFrame } from '../src/snow-vision.ts'

const drawing = []
const context = () => ({
  globalCompositeOperation: 'source-over',
  save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, arc() {}, moveTo() {}, lineTo() {}, clearRect() {},
  fill() { drawing.push(['fill', this.globalCompositeOperation]) }, stroke() { drawing.push(['stroke', this.globalCompositeOperation]) },
  fillRect() { drawing.push(['fillRect', this.globalCompositeOperation]) }, drawImage() { drawing.push(['drawImage', this.globalCompositeOperation]) },
  createRadialGradient() { return { addColorStop() {} } },
})
globalThis.document = { hidden: false, addEventListener() {}, createElement: () => ({ width: 0, height: 0, getContext: () => context() }) }
globalThis.ResizeObserver = class { observe() {} }
globalThis.requestAnimationFrame = () => 1
globalThis.cancelAnimationFrame = () => {}
globalThis.window = { isSecureContext: true }
function fixture() {
  const nodes = new Map()
  const get = selector => { if (!nodes.has(selector)) nodes.set(selector, { hidden: false, disabled: false, textContent: '', addEventListener() {} }); return nodes.get(selector) }
  const video = { srcObject: null, videoWidth: 960, videoHeight: 720, readyState: 2, async play() {}, pause() {} }
  const root = { querySelector: selector => selector === 'video' ? video : selector === 'canvas' ? { getContext: () => context() } : get(selector), querySelectorAll: () => [] }
  const snow = new SnowScene(root); snow.active = true
  return { snow, get, video }
}
test('breathing creates a fog mask, finger drawing erases it, and fog fades over time', () => {
  drawing.length = 0
  const fog = new SnowFog(800, 600); fog.breath(400, 300, 150)
  assert.ok(fog.amount > 0)
  fog.wipe({ x: 350, y: 300 }, { x: 450, y: 300 })
  assert.ok(drawing.some(([op, mode]) => op === 'stroke' && mode === 'destination-out'))
  const before = fog.amount; fog.step(1); assert.ok(fog.amount < before)
  for (let i = 0; i < 100; i++) fog.step(1)
  assert.equal(fog.amount, 0)
})
test('fog is a masked blurred copy of the live camera image', () => {
  drawing.length = 0
  const fog = new SnowFog(800, 600); fog.breath(400, 300, 150)
  fog.image({ readyState: 2, videoWidth: 960, videoHeight: 720 }, 1000)
  assert.ok(drawing.some(([op, mode]) => op === 'drawImage' && mode === 'destination-in'))
})
test('HumanSeg category output is copied into a person-only mask', () => {
  const source = new Uint8Array([0, 1, 1, 0])
  const models = {
    hand: { detectForVideo: () => ({ landmarks: [], worldLandmarks: [] }) },
    face: { detectForVideo: () => ({ faceLandmarks: [] }) },
    segment: { segmentForVideo: (image, time, callback) => callback({ categoryMask: { width: 2, height: 2, getAsUint8Array: () => source } }) },
  }
  const sample = detectSnowFrame(models, {}, 1000, true)
  assert.deepEqual([...sample.mask.data], [0, 1, 1, 0])
  source.fill(0); assert.equal(sample.mask.data[1], 1, 'returned mask survives disposal of model-owned buffers')
  assert.equal(detectSnowFrame(models, {}, 1100, false).mask, undefined)
})
test('camera permission arriving after Snow is closed is stopped immediately', async () => {
  let grant; Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => new Promise(resolve => { grant = resolve }) } } })
  const { snow, video } = fixture(); let stops = 0
  const pending = snow.start(); snow.stop(); grant({ getTracks: () => [{ stop() { stops++ } }] }); await pending
  assert.equal(stops, 1); assert.equal(video.srcObject, null)
})
test('leaving Snow closes tracking and camera and discards snow and fog', () => {
  const { snow, video, get } = fixture(); let stops = 0, closes = 0
  snow.tracker = { close() { closes++ } }; snow.stream = { getTracks: () => [{ stop() { stops++ } }] }; video.srcObject = snow.stream
  snow.physics.add(10, 10); snow.beard.growth = 1
  snow.setActive(false)
  assert.equal(stops, 1); assert.equal(closes, 1); assert.equal(video.srcObject, null); assert.equal(snow.physics.particles.length, 0); assert.equal(snow.beard.growth, 0); assert.equal(get('.snow-entry').hidden, false)
})

function indexSample(x, y, timestamp) {
  const p = Array.from({ length: 21 }, () => ({ x: .5, y: .6, z: 0 }))
  p[0] = { x: .5, y: .9 }; p[5] = { x: .35, y: .6 }; p[6] = { x: .35, y: .35 }; p[8] = { x: .35, y: -.1 }; p[4] = { x: .5, y: .57 }
  for (const [mcp, pip, tip, px] of [[9, 10, 12, .5], [13, 14, 16, .65], [17, 18, 20, .75]]) { p[mcp] = { x: px, y: .6 }; p[pip] = { x: px, y: .4 }; p[tip] = { x: px + .03, y: .65 } }
  const landmarks = p.map(point => ({ ...point })); landmarks[8] = { x, y, z: 0 }
  return { timestamp, landmarks, world: p }
}
function facePoints() {
  const p = Array.from({ length: 468 }, () => ({ x: .5, y: .5, z: 0 }))
  p[234] = { x: .35, y: .45 }; p[454] = { x: .65, y: .45 }
  p[13] = { x: .5, y: .5 }; p[14] = { x: .5, y: .57 }
  p[61] = { x: .45, y: .53 }; p[291] = { x: .55, y: .53 }
  p[2] = { x: .5, y: .46 }; p[152] = { x: .5, y: .7 }
  return p
}
test('an index poke on a cloud starts its snowfall with a short recognition debounce', () => {
  const { snow } = fixture(); snow.width = 800; snow.height = 600
  snow.clouds = [{ x: .5, y: .45, width: 100, phase: 0, rainUntil: 0, lastPoke: -Infinity, emission: 0, touchSince: 0 }]
  snow.process(indexSample(.5, .45, 1000), 1000); assert.equal(snow.clouds[0].rainUntil, 0)
  snow.process(indexSample(.5, .45, 1120), 1120); assert.ok(snow.clouds[0].rainUntil > 9000)
})
test('an open mouth produces mist during snowfall, and a closed mouth does not', () => {
  const { snow } = fixture(); snow.width = 800; snow.height = 600
  snow.clouds = [{ rainUntil: 5000 }]; let breaths = 0
  snow.fog = { breath() { breaths++ } }
  const points = facePoints(); snow.updateFace(points, 1000); assert.equal(breaths, 1)
  points[14].y = .505; snow.updateFace(points, 1200); assert.equal(breaths, 1)
  points[14].y = .57; snow.clouds[0].rainUntil = 0; snow.updateFace(points, 1400); assert.equal(breaths, 1)
})
test('shaking sheds the built beard as falling flakes', () => {
  const { snow } = fixture(); snow.width = 800; snow.height = 600
  snow.updateFace(facePoints(), 1000); snow.beard.growth = 1
  snow.shakeOff(); assert.equal(snow.beard.growth, 0)
  assert.ok(snow.physics.particles.length > 20)
  assert.ok(snow.physics.particles.every(p => p.freeUntil > 0))
})
