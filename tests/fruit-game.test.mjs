import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FruitRound, handPose, isIndexOnly, coverPoint, segmentHitsCircle, roundDuration } from '../src/fruit-game-core.ts'
import { pageFromHash, weekForPage } from '../src/pages.ts'

const target = kind => ({ kind, x: 100, y: 100, vx: 0, vy: 0, radius: 30, angle: 0, spin: 0 })
const slash = (game, kind, now) => { game.object = target(kind); return game.slash({ x: 20, y: 100 }, { x: 180, y: 100 }, now) }
test('a fast segment can cut through a fruit without a fingertip landing on it', () => {
  assert.equal(segmentHitsCircle({ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 100, y: 5 }, 20), true)
  assert.equal(segmentHitsCircle({ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 100, y: 30 }, 20), false)
  assert.equal(segmentHitsCircle({ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 100 }, 30), false)
})
test('fruit cuts increment the score and combo, bombs reset only the combo', () => {
  const game = new FruitRound(); game.start(0)
  assert.equal(slash(game, 'watermelon', 100).kind, 'watermelon')
  slash(game, 'peach', 200); assert.equal(game.score, 2); assert.equal(game.combo, 2)
  slash(game, 'bomb', 300); assert.equal(game.score, 2); assert.equal(game.combo, 0); assert.equal(game.bombs, 1)
  slash(game, 'avocado', 400); assert.equal(game.combo, 1); assert.equal(game.bestCombo, 2)
})
test('one target stays in flight at a time and a missed fruit resets the combo', () => {
  const game = new FruitRound(); game.start(0); game.step(500, 0, 800, 600, () => .5)
  const object = game.object
  game.step(550, .05, 800, 600, () => 0); assert.equal(game.object, object)
  game.combo = 4; Object.assign(game.object, { y: 800, vy: 200 })
  game.step(600, .02, 800, 600); assert.equal(game.object, undefined); assert.equal(game.combo, 0); assert.equal(game.misses, 1)
  game.step(900, 0, 800, 600); assert.equal(game.object, undefined)
  game.step(960, 0, 800, 600); assert.ok(game.object)
})
test('avoiding a bomb preserves the combo', () => {
  const game = new FruitRound(); game.start(0); game.combo = 3; game.object = { ...target('bomb'), y: 800, vy: 200 }
  game.step(500, .02, 800, 600); assert.equal(game.combo, 3); assert.equal(game.bombs, 0)
})
test('the round ends at 60 seconds and rejects late cuts; restart clears all counters', () => {
  const game = new FruitRound(); game.start(1000); slash(game, 'apple', 2000)
  game.object = target('pineapple')
  assert.equal(game.slash({ x: 0, y: 100 }, { x: 200, y: 100 }, 1000 + roundDuration), undefined)
  game.step(1000 + roundDuration, .01, 800, 600); assert.equal(game.running, false); assert.equal(game.object, undefined); assert.equal(game.score, 1)
  game.start(70000); assert.equal(game.score, 0); assert.equal(game.bestCombo, 0); assert.equal(game.remaining(70000), roundDuration)
})
test('tracking coordinates match the mirrored camera and center-cropped video', () => {
  assert.deepEqual(coverPoint({ x: .25, y: .5 }, 1280, 720, 1280, 720), { x: 960, y: 360 })
  const center = coverPoint({ x: .5, y: .5 }, 1280, 720, 400, 800)
  assert.ok(Math.abs(center.x - 200) < .001 && Math.abs(center.y - 400) < .001)
  const edge = coverPoint({ x: 0, y: .5 }, 1280, 720, 400, 800)
  assert.ok(edge.x > 400)
})
const indexPose = () => {
  const p = Array.from({ length: 21 }, () => ({ x: 0, y: .6, z: 0 }))
  p[0] = { x: 0, y: .9 }; p[5] = { x: -.15, y: .6 }; p[6] = { x: -.15, y: .35 }; p[8] = { x: -.15, y: -.1 }
  p[4] = { x: 0, y: .57 }
  for (const [mcp, pip, tip, x] of [[9, 10, 12, 0], [13, 14, 16, .15], [17, 18, 20, .25]]) { p[mcp] = { x, y: .6 }; p[pip] = { x, y: .4 }; p[tip] = { x: x + .03, y: .65 } }
  return p
}
test('gesture accepts an extended index, rejects an open hand, fist and extended thumb', () => {
  assert.equal(isIndexOnly(indexPose()), true)
  const open = indexPose(); open[12] = { x: 0, y: -.05 }; assert.equal(isIndexOnly(open), false)
  const fist = indexPose(); fist[8] = { x: -.1, y: .65 }; assert.equal(isIndexOnly(fist), false)
  const thumb = indexPose(); thumb[4] = { x: -.65, y: .35 }; assert.equal(isIndexOnly(thumb), false)
  assert.equal(isIndexOnly([]), false)
})
test('week three has its own page without changing the old routes', () => {
  assert.equal(pageFromHash('#ninth'), 'ninth'); assert.equal(weekForPage('ninth'), '3')
  assert.equal(weekForPage('eighth'), '2'); assert.equal(weekForPage('first'), '1')
  assert.equal(pageFromHash('#eighth'), 'eighth'); assert.equal(pageFromHash('#unknown'), 'first')
})

test('open palm and fist are distinct from the index-only slicing pose', () => {
  const open = indexPose()
  for (const [mcp, pip, tip] of [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]]) {
    open[pip] = { x: open[mcp].x, y: .35 }; open[tip] = { x: open[mcp].x, y: -.1 }
  }
  open[4] = { x: -.65, y: .35 }
  assert.equal(handPose(open), 'open')
  const fist = indexPose(); fist[8] = { x: -.1, y: .65 }
  assert.equal(handPose(fist), 'fist'); assert.equal(handPose(indexPose()), 'index')
})
test('pause freezes time, position, score and combo; resume continues the same flight', () => {
  const game = new FruitRound(); game.start(0); slash(game, 'apple', 100)
  game.object = target('peach'); const object = game.object
  game.pause(1000); const remaining = game.remaining(1000)
  game.step(25000, 3, 800, 600)
  assert.equal(game.remaining(25000), remaining); assert.equal(game.object, object); assert.equal(object.y, 100)
  assert.equal(game.slash({ x: 0, y: 100 }, { x: 200, y: 100 }, 25000), undefined)
  assert.equal(game.combo, 1); assert.equal(game.score, 1)
  assert.equal(game.resume(25000), 24000); assert.equal(game.remaining(25000), remaining)
  assert.equal(game.remaining(26000), remaining - 1000)
  assert.equal(slash(game, 'peach', 26000).kind, 'peach'); assert.equal(game.combo, 2)
})
test('pausing between targets also preserves the wait until the next target', () => {
  const game = new FruitRound(); game.start(0); game.pause(100)
  game.resume(10100); game.step(10400, 0, 800, 600); assert.equal(game.object, undefined)
  game.step(10450, 0, 800, 600); assert.ok(game.object)
})
