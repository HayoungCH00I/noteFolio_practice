import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PoseWallRound, approachMs, countdownMs, openingFeedback, passThroughMs } from '../src/pose-wall-core.ts'
import { makeOpening } from '../src/pose-wall-opening.ts'
import { choosePose } from '../src/pose-wall-presets.ts'
import { readBodies } from '../src/pose-wall-vision.ts'
import { pageFromHash, weekForPage } from '../src/pages.ts'

function matchingBodies(opening) {
  const { frameWidth: width, frameHeight: height, figures } = opening
  const masks = figures.map(() => new Uint8Array(width * height))
  const centers = figures.map(figure => (figure[1].x + figure[4].x) / 2)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const tx = Math.floor(x + .5 - opening.left * width)
    const ty = Math.floor(y + .5 - opening.top * height)
    if (tx < 0 || tx >= opening.width || ty < 0 || ty >= opening.height || !opening.data[ty * opening.width + tx]) continue
    const index = centers.length === 2 && x / width > (centers[0] + centers[1]) / 2 ? 1 : 0
    masks[index][y * width + x] = 255
  }
  return figures.map((joints, i) => ({ mask: { width, height, data: masks[i] }, joints, x: centers[i] }))
}

function drive(game) {
  let now = 0
  game.advance(now, [], 960, 720)
  return (ms, bodies = []) => {
    const end = now + ms
    while (now < end) { now += Math.min(50, end - now); game.advance(now, bodies, 960, 720) }
  }
}

test('random apertures include all nine reference poses and do not repeat immediately', ({ mock }) => {
  let fraction = 0
  mock.method(Math, 'random', () => fraction)
  for (const [mode, count] of [[1, 5], [2, 4]]) {
    const first = choosePose(mode)
    assert.equal(first.figures.length, mode)
    assert.notEqual(choosePose(mode, first), first)
    const names = new Set()
    for (let index = 0; index < count; index++) {
      fraction = (index + .5) / count
      const pose = choosePose(mode)
      names.add(pose.name)
      for (const opening of [makeOpening(pose, 720, 1280), makeOpening(pose, 1280, 720)]) {
        assert.equal(opening.figures.length, mode)
        assert.ok(opening.data.some(Boolean))
        assert.ok(opening.left > 0 && opening.top > 0)
        assert.ok(opening.width / opening.frameWidth + opening.left < 1)
        assert.ok(opening.height / opening.frameHeight + opening.top < 1)
        assert.deepEqual(openingFeedback(opening, matchingBodies(opening)), Array(mode).fill('ready'))
      }
    }
    assert.equal(names.size, count)
  }
})

test('two-player matching checks both fixed positions regardless of detector order', () => {
  const opening = makeOpening(choosePose(2), 1280, 720)
  const [left, right] = matchingBodies(opening)
  assert.deepEqual(openingFeedback(opening, [right, left]), ['ready', 'ready'])
  assert.deepEqual(openingFeedback(opening, [left]), ['ready', 'waiting'])
  const moved = { ...right, x: right.x + .28, joints: right.joints.map(p => ({ ...p, x: p.x + .28 })) }
  assert.deepEqual(openingFeedback(opening, [left, moved]), ['ready', 'adjust'])
})

test('framing starts a real countdown and the first wall is unscored practice', () => {
  const game = new PoseWallRound(2)
  const advance = drive(game)
  const fixed = game.opening
  const players = matchingBodies(fixed)
  advance(countdownMs, [players[0]])
  assert.equal(game.phase, 'waiting')
  advance(350, players)
  assert.equal(game.countdown, 3)
  assert.deepEqual(game.feedback, [])
  advance(900, players)
  assert.deepEqual(game.feedback, ['waiting', 'waiting'])
  advance(countdownMs - 900, players)
  assert.equal(game.phase, 'wall')
  advance(1000)
  assert.equal(game.progress, .25)
  assert.equal(game.opening, fixed)
  advance(approachMs - 1000, players)
  assert.equal(game.phase, 'passing')
  assert.equal(game.outcome, 'pass')
  assert.equal(game.score, 0)
  const preset = game.preset
  advance(passThroughMs)
  assert.equal(game.practice, false)
  assert.equal(game.opening, undefined)
  advance(50)
  assert.notEqual(game.preset, preset)
})

test('arm direction allows size changes and missing feet, and returns independent states', () => {
  const opening = makeOpening(choosePose(2), 1280, 720)
  const [left, right] = matchingBodies(opening)
  const scaled = {
    ...left,
    mask: undefined,
    joints: left.joints.map((joint, index) => [9, 12].includes(index) ? undefined : {
      x: left.x + (joint.x - left.x) * .78,
      y: .15 + joint.y * .78,
    }),
  }
  const wrong = {
    ...right,
    joints: right.joints.map((joint, index) => [2, 3, 5, 6].includes(index) ? {
      x: joint.x, y: 1 - joint.y,
    } : joint),
  }
  assert.deepEqual(openingFeedback(opening, [right, scaled]), ['ready', 'ready'])
  assert.deepEqual(openingFeedback(opening, [wrong, scaled]), ['ready', 'adjust'])
  assert.deepEqual(openingFeedback(opening, [scaled]), ['ready', 'waiting'])
})

test('missing recent tracking repeats the same wall without a collision', () => {
  const game = new PoseWallRound(1)
  game.practice = false
  const advance = drive(game)
  const fixed = game.opening
  const players = matchingBodies(fixed)
  advance(350, players)
  advance(countdownMs, players)
  advance(approachMs - 150, players)
  advance(150)
  assert.equal(game.outcome, 'pass', 'brief missing tracking is tolerated')
  assert.equal(game.score, 1)
  advance(passThroughMs)
  advance(50)
  const next = game.opening
  advance(350, matchingBodies(next))
  advance(countdownMs)
  advance(approachMs)
  assert.equal(game.outcome, 'retry')
  assert.equal(game.misses, 0)
  advance(passThroughMs)
  assert.equal(game.opening, next)
  assert.equal(game.phase, 'waiting')
})

test('four confirmed collisions end the scored game', ({ mock }) => {
  mock.method(Math, 'random', () => 0)
  const game = new PoseWallRound(1)
  game.practice = false
  const advance = drive(game)
  for (let i = 1; i <= 4; i++) {
    advance(50)
    const opening = game.opening
    const bodies = matchingBodies(opening)
    const wrong = bodies.map(body => ({ ...body, x: body.x - .35 }))
    advance(350, bodies)
    advance(countdownMs)
    advance(approachMs, wrong)
    assert.equal(game.outcome, 'hit')
    assert.equal(game.opening, opening)
    assert.equal(game.misses, i)
    assert.equal(game.score, 0)
    advance(passThroughMs)
    assert.equal(game.phase, i === 4 ? 'over' : 'waiting')
  }
})

test('body tracking keeps each of the two people paired with their own mask', () => {
  const person = x => Array.from({ length: 33 }, () => ({ x, y: .5, visibility: 1 }))
  const mask = data => ({ width: 4, height: 1, getAsFloat32Array: () => Float32Array.from(data) })
  const model = { detectForVideo(_frame, _timestamp, callback) {
    callback({ landmarks: [person(.7), person(.3)], segmentationMasks: [mask([0, 0, 1, 0]), mask([0, 1, 0, 0])] })
  } }
  const result = readBodies(model, {}, 1)
  assert.deepEqual(result.map(person => person.x), [.7, .3])
  assert.deepEqual(result.map(person => [...person.mask.data]), [[0, 0, 255, 0], [0, 255, 0, 0]])
})

test('the game is available under week four', () => {
  assert.equal(pageFromHash('#fifteenth'), 'fifteenth')
  assert.equal(weekForPage('fifteenth'), '4')
})
