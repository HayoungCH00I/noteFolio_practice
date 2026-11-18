import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ChoirGestures, readChoirHand, isCircularPath } from '../src/choir-gestures.ts'
const hand = (pose, x = .5, y = .5, pitch) => ({ pose, palm: { x, y }, tip: { x, y }, pitch })
function points(count, gap = .14, rotate = 0) {
  const p = Array.from({ length: 21 }, () => ({ x: .5, y: .6, z: 0 }))
  p[0] = { x: .5, y: .9 }; p[2] = { x: .38, y: .75 }; p[4] = { x: .35 - gap, y: .3 }
  for (const [i, mcp] of [5, 9, 13, 17].entries()) {
    const x = .35 + i * .1; p[mcp] = { x, y: .65 }; p[mcp + 1] = { x, y: .45 }
    p[mcp + 3] = { x: x + (i < count ? 0 : .03), y: i < count ? .25 : .7 }
  }
  return p.map(({ x, y }) => ({ x: .5 + (x - .5) * Math.cos(rotate) - (y - .5) * Math.sin(rotate), y: .5 + (x - .5) * Math.sin(rotate) + (y - .5) * Math.cos(rotate), z: 0 }))
}
test('finger counts distinguish the three conducting shapes, a pointing finger and fists even rotated sideways', () => {
  for (const rotate of [0, Math.PI / 2, -Math.PI / 2]) for (const [count, pose] of [[0, 'fist'], [1, 'point'], [2, 'two'], [3, 'three'], [4, 'open']]) assert.equal(readChoirHand(points(count, .14, rotate)).pose, pose)
})
test('left finger spacing changes pitch; releasing the shape or losing tracking returns to neutral', () => {
  const narrow = readChoirHand(points(1, -.02)), wide = readChoirHand(points(1, .3))
  assert.ok(narrow.pitch < wide.pitch)
  const gesture = new ChoirGestures(); gesture.hands(wide, hand('open'), 1000, true)
  gesture.advance(1050); assert.ok(gesture.pitch > 0 && gesture.pitch <= .2)
  const previous = gesture.pitch
  gesture.hands(hand('open'), hand('open'), 1100, true); gesture.advance(1150); assert.ok(gesture.pitch < previous)
  gesture.hands(wide, hand('open'), 1200, true); gesture.advance(1250); const elevated = gesture.pitch
  for (let now = 1800; now < 5000; now += 50) gesture.advance(now)
  assert.ok(elevated > 0); assert.equal(gesture.pitch, 0)
})
test('pitch follows gradual finger movements and rejects abrupt jumps at a maximum of four semitones per second', () => {
  const gesture = new ChoirGestures()
  for (let time = 1000; time <= 2000; time += 50) { gesture.hands(hand('point', .3, .5, 6), hand('open'), time, true); gesture.advance(time, .05) }
  assert.ok(gesture.pitch > 2 && gesture.pitch < 4.3)
  const before = gesture.pitch; gesture.hands(hand('point', .3, .5, -6), hand('open'), 2050, true); gesture.advance(2050, .05)
  assert.ok(before - gesture.pitch <= .20001)
})
test('both fists pause; two vertical index taps start a three-second countdown and resume at its end', () => {
  const gesture = new ChoirGestures()
  gesture.hands(hand('fist'), hand('open'), 100, true); assert.equal(gesture.paused, false)
  gesture.hands(hand('fist'), hand('fist'), 200, true); gesture.hands(hand('fist'), hand('fist'), 500, true)
  assert.equal(gesture.paused, true)
  for (const [time, y] of [[600, .4], [800, .5], [1000, .4], [1200, .5], [1400, .4]]) gesture.hands(undefined, hand('point', .5, y), time, true)
  assert.equal(gesture.taps, 2); assert.equal(gesture.resumeAt, 4400)
  gesture.advance(4399); assert.equal(gesture.paused, true)
  gesture.advance(4400); assert.equal(gesture.paused, false)
})
test('pointing at one singer and wagging scolds that singer without pausing; a straight tap does not', () => {
  const gesture = new ChoirGestures()
  gesture.hands(undefined, hand('point'), 100, true, 2); gesture.hands(undefined, hand('point'), 500, true, 2)
  assert.equal(gesture.selected, 2)
  for (const [time, x] of [[600, .56], [750, .44], [900, .56]]) gesture.hands(undefined, hand('point', x), time, true, -1)
  assert.equal(gesture.scolded, 2); assert.equal(gesture.paused, false); assert.equal(gesture.resumeAt, 0)
  gesture.advance(5500); assert.equal(gesture.scolded, -1)
})
test('circular conducting requires a loop rather than a diagonal back-and-forth movement', () => {
  const loop = Array.from({ length: 20 }, (_, i) => ({ x: .5 + Math.sin(i / 20 * Math.PI * 2) * .1, y: .5 - Math.cos(i / 20 * Math.PI * 2) * .1 }))
  assert.equal(isCircularPath(loop), true)
  assert.equal(isCircularPath(loop.map(p => ({ x: p.x, y: p.x }))), false)
})
