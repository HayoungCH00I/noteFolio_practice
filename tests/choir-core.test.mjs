import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Conducting, ConductingSequence, choirRating, choirVideo, conductingMotions } from '../src/choir-core.ts'
import { detectChoirFrame } from '../src/choir-vision.ts'
import { pageFromHash, weekForPage } from '../src/pages.ts'

test('the requested chorus uses 18 to 112 seconds and remains in week three', () => {
  assert.equal(choirVideo.id, '64fwAdHw18I'); assert.equal(choirVideo.start, 18); assert.equal(choirVideo.end, 112); assert.equal(choirVideo.end - choirVideo.start, 94)
  assert.equal(pageFromHash('#eleventh'), 'eleventh'); assert.equal(weekForPage('eleventh'), '3'); assert.equal(weekForPage('tenth'), '3')
})
test('the three conducting options use different finger poses, directions and tempos', () => {
  assert.equal(Object.keys(conductingMotions).length, 3)
  assert.deepEqual(Object.values(conductingMotions).map(motion => motion.pose), ['open', 'two', 'three'])
  assert.deepEqual(Object.values(conductingMotions).map(motion => motion.rate), [.75, 1.25, 1])
})
test('automatic instructions change every ten singing seconds, avoid immediate repeats and wait while paused', () => {
  let next = 0; const sequence = new ConductingSequence(() => next)
  assert.equal(sequence.motion, 'vertical')
  assert.equal(sequence.advance(9, true), false); assert.equal(sequence.advance(20, false), false)
  assert.equal(sequence.advance(1, true), true); assert.equal(sequence.motion, 'sweep')
  next = .99; assert.equal(sequence.advance(10, true), true); assert.equal(sequence.motion, 'circle')
  sequence.reset(); assert.equal(sequence.motion, 'circle'); assert.equal(sequence.advance(10, true), true); assert.notEqual(sequence.motion, 'circle')
})
test('harmony is presented as the four requested levels with stable boundaries', () => {
  assert.equal(choirRating(0).label, 'BAD'); assert.equal(choirRating(.249).key, 'bad')
  assert.equal(choirRating(.25).label, 'SO SO'); assert.equal(choirRating(.499).key, 'soso')
  assert.equal(choirRating(.5).label, 'NICE'); assert.equal(choirRating(.799).key, 'nice')
  assert.equal(choirRating(.8).label, 'EXCELLENT!'); assert.equal(choirRating(1).key, 'excellent')
})
function conduct(offset = 0, validPose = true) {
  const controls = new Conducting(); controls.reset(0)
  for (let i = 1; i <= 240; i++) {
    const now = i * 50; controls.advance(.05, now, true)
    const y = .5 - Math.cos((controls.phase + offset) * Math.PI * 2) * .16
    controls.hands([{ x: .3, y }, { x: .7, y }], now, true, validPose)
  }
  return controls
}
test('synchronous downward beats matching the hand guide yield a harmonious chorus', () => {
  const controls = conduct(); assert.ok(controls.matched >= 6); assert.ok(controls.harmony >= .8); assert.equal(controls.still, false)
})
test('consistently conducting half a beat late lowers harmony', () => {
  const controls = conduct(.5); assert.ok(controls.beats >= 6); assert.ok(controls.harmony < .55)
})
test('a correctly timed movement with the wrong finger shape lowers harmony', () => {
  const controls = conduct(0, false); assert.ok(controls.beats >= 6); assert.ok(controls.harmony < .55)
})
test('stationary-hand detection ignores minor tracking noise', () => {
  const controls = new Conducting(); controls.reset(0)
  for (let i = 1; i < 60; i++) { const now = i * 50; controls.hands([{ x: .3, y: .5 + Math.sin(i) * .002 }, { x: .7, y: .5 }], now, false); controls.advance(.05, now, false) }
  assert.equal(controls.still, true)
  controls.hands([{ x: .3, y: .6 }, { x: .7, y: .6 }], 3000, false); controls.advance(.05, 3000, false)
  assert.equal(controls.still, false)
})
test('losing a hand pauses tracking instead of grading it as poor conducting', () => {
  const controls = new Conducting(); controls.reset(0); controls.hands([{ x: .3, y: .4 }, { x: .7, y: .4 }], 1000, true)
  controls.advance(.05, 1600, true); assert.equal(controls.hasHands, false); assert.equal(controls.beats, 0)
})
test('tracking returns both full hands without requiring a particular finger pose', () => {
  const hands = [Array.from({ length: 21 }, () => ({ x: .3, y: .4, z: 0 })), Array.from({ length: 21 }, () => ({ x: .7, y: .5, z: 0 }))]
  const sample = detectChoirFrame({ hand: { detectForVideo: () => ({ landmarks: hands, worldLandmarks: [], handedness: [[{ categoryName: 'Left' }], [{ categoryName: 'Right' }]] }) } }, {}, 1000)
  assert.equal(sample.hands.length, 2); assert.equal(sample.hands[1][0].x, .7); assert.equal(sample.timestamp, 1000); assert.deepEqual(sample.handedness, ['Left', 'Right'])
})
