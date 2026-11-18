import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HumanSurface, SnowPhysics } from '../src/snow-physics.ts'
import { SnowBeard, HeadShake, beardPatterns } from '../src/snow-beard.ts'
import { pageFromHash, weekForPage } from '../src/pages.ts'

function surface() {
  const width = 80, height = 80, data = new Uint8Array(width * height)
  for (let y = 40; y < height; y++) for (let x = 8; x < 72; x++) data[y * width + x] = 1
  return new HumanSurface({ width, height, data }, 200, 200, 200, 200)
}
test('human mask yields an upward collision normal at the head/shoulder boundary', () => {
  const body = surface()
  assert.ok(body.distance(100, 90) > 0); assert.ok(body.distance(100, 110) < 0)
  assert.ok(body.normal(100, 100).y < -.9)
})
test('snow collides with a human silhouette and settles instead of falling through', () => {
  const snow = new SnowPhysics(); snow.surface = surface(); snow.add(100, 40, 3, 0, 15)
  for (let i = 0; i < 240; i++) snow.step(1 / 60, 200, 200)
  assert.equal(snow.particles.length, 1)
  const p = snow.particles[0]
  assert.ok(p.y > 90 && p.y < 101, `snow rests at the boundary: ${p.y}`)
  assert.ok(Math.abs(p.vy) < 3)
})
test('snow piles on other snow and falls again when the body moves away', () => {
  const snow = new SnowPhysics(); snow.surface = surface()
  for (const x of [88, 94, 100, 106, 112]) snow.add(x, 96, 3, 0, 0)
  snow.add(100, 50, 3, 0, 0)
  for (const p of snow.particles) p.phase = 0
  for (let i = 0; i < 240; i++) snow.step(1 / 60, 200, 200)
  const sorted = [...snow.particles].sort((a, b) => a.y - b.y)
  assert.equal(sorted.length, 6)
  assert.ok(sorted.at(-1).y - sorted[0].y > 4, 'flakes stay separate in a pile')
  const before = sorted[0].y; snow.surface = undefined
  for (let i = 0; i < 60; i++) snow.step(1 / 60, 200, 200)
  assert.ok(sorted[0].y > before + 25, 'unsupported snow falls under gravity')
})
test('surface friction reduces lateral sliding on a flat shoulder', () => {
  const snow = new SnowPhysics(); snow.surface = surface(); snow.add(80, 96, 3, 35, 0)
  for (let i = 0; i < 60; i++) snow.step(1 / 60, 200, 200)
  assert.ok(Math.abs(snow.particles[0].vx) < 8)
})
test('beard grows only with snowfall and a visible face, and responds to petting when complete', () => {
  const beard = new SnowBeard(); beard.step(2, false, true); assert.equal(beard.growth, 0)
  beard.step(2, true, false); assert.equal(beard.growth, 0)
  for (let i = 0; i < 800; i++) beard.step(1 / 60, true, true)
  assert.equal(beard.growth, 1); beard.stroke(15, 4, 150); beard.step(1 / 60, false, true)
  assert.ok(beard.bend > 0)
  for (let i = 0; i < 300; i++) beard.step(1 / 60, false, true)
  assert.ok(Math.abs(beard.bend) < .01, 'snow beard returns with a damped spring')
  beard.shakeOff(); assert.equal(beard.growth, 0); beard.step(.5, true, true); assert.equal(beard.growth, 0)
})
test('beard has three different shapes and changing style starts fresh', () => {
  assert.equal(beardPatterns.length, 3)
  assert.ok(Math.max(...beardPatterns[0].map(p => p.y)) < .13)
  assert.ok(Math.max(...beardPatterns[1].map(p => p.y)) > .8)
  assert.ok(Math.max(...beardPatterns[2].map(p => Math.abs(p.x))) < .08)
  const beard = new SnowBeard(); beard.growth = 1; beard.choose(2); assert.equal(beard.style, 2); assert.equal(beard.growth, 0)
})
test('quick back-and-forth head motion shakes snow off, steady head position does not', () => {
  const steady = new HeadShake()
  for (let i = 0; i < 20; i++) assert.equal(steady.sample(.5, .002 * Math.sin(i), 1000 + i * 100), false)
  const shake = new HeadShake(); shake.sample(.5, 0, 1000); shake.sample(.5, .25, 1100)
  assert.equal(shake.sample(.5, -.25, 1200), false)
  assert.equal(shake.sample(.5, .25, 1300), true)
  const wrapped = new HeadShake(); wrapped.sample(.5, Math.PI - .001, 1000)
  assert.equal(wrapped.sample(.5, -Math.PI + .001, 1100), false)
})
test('Snow is in week three and existing games keep their routes', () => {
  assert.equal(pageFromHash('#tenth'), 'tenth'); assert.equal(weekForPage('tenth'), '3'); assert.equal(weekForPage('ninth'), '3'); assert.equal(weekForPage('eighth'), '2')
})

test('person-mask collisions use the same mirrored coordinate system as the camera', () => {
  const data = new Uint8Array(40 * 40)
  for (let y = 20; y < 40; y++) for (let x = 0; x < 20; x++) data[y * 40 + x] = 1
  const body = new HumanSurface({ width: 40, height: 40, data }, 200, 200, 200, 200)
  assert.ok(body.distance(150, 150) < 0); assert.ok(body.distance(50, 150) > 0)
})
