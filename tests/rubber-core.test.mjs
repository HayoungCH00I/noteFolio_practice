import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Dough, pinchDistance } from '../src/rubber-core.ts'

test('pinch is measured relative to the size of the hand', () => {
  const hand = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }))
  hand[5] = { x: .2, y: 0 }; hand[4] = { x: .05, y: 0 }
  assert.ok(Math.abs(pinchDistance(hand) - .25) < 1e-10)
  assert.equal(pinchDistance([]), Infinity)
})
test('stretches stay after release, accumulate locally, and return only after rubbing', () => {
  const dough = new Dough(), center = { x: 0, y: 0 }
  dough.pull({ x: -.3, y: 0 }, { x: -.2, y: 0 })
  const left = dough.sourceAt({ x: -.5, y: 0 })
  assert.ok(left && Math.abs(left.x + .3) < .06)
  const retained = [...dough.offsets]
  dough.update(center, 1, 1); dough.update(center, 1, 1)
  assert.deepEqual([...dough.offsets], retained)
  dough.pull({ x: .3, y: 0 }, { x: .2, y: 0 })
  assert.ok(dough.sourceAt({ x: .5, y: 0 }))
  const middle = (32 * 65 + 32) * 2
  assert.ok(Math.abs(dough.offsets[middle]) < .02)
  for (let i = 0; i < 150; i++) dough.restore(1 / 60)
  assert.ok(dough.offsets.every(value => value === 0))
})

test('rubber person is available in week four', async () => {
  const { pageFromHash, weekForPage } = await import('../src/pages.ts')
  assert.equal(pageFromHash('#twelfth'), 'twelfth')
  assert.equal(weekForPage('twelfth'), '4')
})

test('photo placement follows face size and tilt', async () => {
  const { facePlacement } = await import('../src/rubber-core.ts')
  const face = Array.from({ length: 455 }, () => ({ x: 0, y: 0 }))
  face[234] = { x: .3, y: .4 }; face[454] = { x: .7, y: .5 }
  face[10] = { x: .5, y: .2 }; face[152] = { x: .5, y: .8 }
  const result = facePlacement(face, 1000, 1000)
  assert.equal(result.x, 500); assert.equal(result.y, 500)
  assert.ok(result.angle > 0 && result.width > 400 && result.height > 600)
})

test('a grabbed face reaches the correct target after mirroring and cover cropping', async () => {
  const { faceTarget } = await import('../src/rubber-core.ts')
  const { coverPoint } = await import('../src/fruit-game-core.ts')
  const targets = [{ left: 850, right: 980, top: 100, bottom: 230 }, { left: 850, right: 980, top: 250, bottom: 380 }]
  const position = coverPoint({ x: .04, y: .5 }, 640, 480, 1000, 500)
  assert.equal(faceTarget(position, targets), 1)
  assert.equal(faceTarget(coverPoint({ x: .96, y: .5 }, 640, 480, 1000, 500), targets), -1)
  assert.equal(faceTarget({ x: 900, y: 240 }, targets), -1)
})

test('one open palm circling near the face restores it; a straight sweep does not', async () => {
  const { RubGesture } = await import('../src/rubber-core.ts')
  const face = Array.from({ length: 455 }, () => ({ x: .5, y: .5 }))
  face[234] = { x: .3, y: .5 }; face[454] = { x: .7, y: .5 }; face[10] = { x: .5, y: .25 }; face[152] = { x: .5, y: .75 }
  const hand = Array.from({ length: 21 }, () => ({ x: .5, y: .6 }))
  hand[0] = { x: .5, y: .9 }; hand[2] = { x: .38, y: .75 }; hand[4] = { x: .2, y: .3 }
  for (const [i, mcp] of [5, 9, 13, 17].entries()) {
    const x = .35 + i * .1; hand[mcp] = { x, y: .65 }; hand[mcp + 1] = { x, y: .45 }; hand[mcp + 3] = { x, y: .25 }
  }
  const shifted = (x, y) => hand.map(p => ({ x: p.x + x, y: p.y + y - .2 }))
  const gesture = new RubGesture()
  for (let i = 0; i < 20; i++) assert.equal(gesture.add([shifted(.1 * Math.sin(i / 20 * Math.PI * 2), 0)], face, i * 50), false)
  let restored = false
  for (let i = 0; i < 25; i++) restored ||= gesture.add([shifted(.1 * Math.sin(i / 20 * Math.PI * 2), .1 * Math.cos(i / 20 * Math.PI * 2))], face, 1100 + i * 40)
  assert.equal(restored, true)
  for (let i = 0; i < 20; i++) assert.equal(gesture.add([shifted(.1 * Math.sin(i / 20 * Math.PI * 2), .1 * Math.cos(i / 20 * Math.PI * 2)), hand], face, 2500 + i * 40), false)
})

test('continuous circular rubbing restores slowly and stops when the hand stops', async () => {
  const { RubGesture } = await import('../src/rubber-core.ts')
  const face = Array.from({ length: 455 }, () => ({ x: .5, y: .5 }))
  face[234] = { x: .3, y: .5 }; face[454] = { x: .7, y: .5 }; face[10] = { x: .5, y: .25 }; face[152] = { x: .5, y: .75 }
  const hand = Array.from({ length: 21 }, () => ({ x: .5, y: .6 }))
  hand[0] = { x: .5, y: .9 }; hand[2] = { x: .38, y: .75 }; hand[4] = { x: .2, y: .3 }
  for (const [i, mcp] of [5, 9, 13, 17].entries()) {
    const x = .35 + i * .1; hand[mcp] = { x, y: .65 }; hand[mcp + 1] = { x, y: .45 }; hand[mcp + 3] = { x, y: .25 }
  }
  const gesture = new RubGesture(), dough = new Dough()
  dough.pull({ x: -.3, y: 0 }, { x: -.2, y: 0 })
  const magnitude = () => Math.max(...dough.offsets.map(Math.abs))
  const initial = magnitude()
  let movingSamples = 0, lastHand = hand
  for (let i = 0; i < 80; i++) {
    const angle = i / 20 * Math.PI * 2
    lastHand = hand.map(p => ({ x: p.x + .1 * Math.sin(angle), y: p.y - .2 + .1 * Math.cos(angle) }))
    if (gesture.add([lastHand], face, i * 50)) { dough.restore(.005); movingSamples++ }
  }
  assert.ok(movingSamples > 30)
  assert.ok(magnitude() > initial * .05 && magnitude() < initial * .8)
  const stopped = magnitude()
  for (let i = 0; i < 10; i++) if (gesture.add([lastHand], face, 4000 + i * 50)) dough.restore(.005)
  assert.equal(magnitude(), stopped)
})

test('only an index-pointing fingertip selects a thumbnail', async () => {
  const { pointedFace } = await import('../src/rubber-core.ts')
  const hand = Array.from({ length: 21 }, () => ({ x: .5, y: .6 }))
  hand[0] = { x: .5, y: .9 }; hand[2] = { x: .38, y: .75 }; hand[4] = { x: .1, y: .45 }
  for (const [i, mcp] of [5, 9, 13, 17].entries()) {
    const x = .35 + i * .1; hand[mcp] = { x, y: .65 }; hand[mcp + 1] = { x, y: .45 }; hand[mcp + 3] = { x, y: i === 0 ? .25 : .7 }
  }
  const frame = { left: 50, top: 20, width: 1000, height: 500 }
  const targets = [{ left: 665, right: 735, top: 60, bottom: 110 }]
  assert.equal(pointedFace([hand], 640, 480, frame, targets), 0)
  const open = hand.map(p => ({ ...p })); for (const mcp of [9, 13, 17]) open[mcp + 3].y = .25
  assert.equal(pointedFace([open], 640, 480, frame, targets), -1)
  const pinch = hand.map(p => ({ ...p })); pinch[4] = pinch[8]
  assert.equal(pointedFace([pinch], 640, 480, frame, targets), -1)
  assert.equal(pointedFace([hand], 640, 480, frame, [{ left: 0, right: 100, top: 0, bottom: 100 }]), -1)
})
