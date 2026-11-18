import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { ClawGame } from '../src/claw-game.ts'
import { pageFromHash } from '../src/pages.ts'

globalThis.requestAnimationFrame = () => 1
globalThis.window = { addEventListener() {} }
globalThis.ResizeObserver = class { observe() {} }
function fixture(random, x = 0) {
  const game = new ClawGame({ querySelector: () => ({ addEventListener() {} }), querySelectorAll: () => [] })
  const status = { textContent: '' }, wins = { textContent: '' }
  const buttons = Array.from({ length: 7 }, () => ({ disabled: false }))
  const mesh = new THREE.Group(); mesh.position.set(x, 1.42, 0)
  const toy = { mesh, home: mesh.position.clone(), falling: false, prize: false, vy: 0 }
  Object.assign(game, { root: { querySelector: selector => selector.includes('wins') ? wins : status, querySelectorAll: () => buttons }, renderer: { render() {} }, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), claw: new THREE.Group(), carriage: new THREE.Mesh(), cable: new THREE.Mesh(), fingers: [], toys: [toy], keys: new Set(), state: 'ready', elapsed: 0, last: 0, active: true, wins: 0 })
  game.claw.position.set(0, 4.3, 0)
  const oldRandom = Math.random; Math.random = () => random
  game.drop(); Math.random = oldRandom
  return { game, toy, buttons, wins }
}
function cycle(game) {
  let time = 0
  while (game.state !== 'ready' && time < 30000) { time += 20; game.tick(time) }
  assert.equal(game.state, 'ready', 'automatic cycle returns to ready')
}
test('stable catch exits machine, counts prize and unlocks controls', () => {
  const { game, buttons, wins } = fixture(.1)
  assert.ok(buttons.every(button => button.disabled))
  game.drop(); assert.equal(game.state, 'down')
  cycle(game)
  assert.equal(wins.textContent, '1'); assert.equal(game.toys.length, 0)
  assert.equal(game.collection.length, 1); assert.equal(game.collection[0].position.z, 2.85)
  assert.equal(game.collection[0].scale.x, .68)
  assert.ok(buttons.every(button => !button.disabled))
  assert.ok(game.claw.position.distanceTo(new THREE.Vector3(0, 4.3, 0)) < .02)
})
test('unstable catch falls back into machine without a prize', () => {
  const { game, toy } = fixture(.99)
  cycle(game)
  assert.equal(game.wins, 0); assert.equal(game.toys.length, 1)
  assert.equal(toy.falling, false); assert.equal(toy.mesh.position.y, toy.home.y)
})
test('missing a doll completes the cycle without creating a prize', () => {
  const { game } = fixture(.1, 1.2)
  assert.equal(game.held, undefined); cycle(game); assert.equal(game.wins, 0)
})
test('inactive scenes do not advance the claw', () => {
  const { game } = fixture(.1); game.active = false
  const y = game.claw.position.y; game.tick(1000); assert.equal(game.claw.position.y, y)
})
test('new and existing hash routes remain valid', () => {
  for (const route of ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh']) assert.equal(pageFromHash(`#${route}`), route)
  assert.equal(pageFromHash('#unknown'), 'first')
})

test('physical dolls settle on the floor in rotated poses', async () => {
  const { createClawWorld, createToyBody, syncToy } = await import('../src/claw-physics.ts')
  const world = createClawWorld()
  const originalRandom = Math.random
  let seed = 42
  Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const toys = Array.from({ length: 14 }, (_, i) => {
    const mesh = new THREE.Group(); mesh.position.set((i % 2 - .5) * .6, 2.5 + Math.floor(i / 2) * .6, (i % 3 - 1) * .5)
    return { mesh, body: createToyBody(mesh, world) }
  })
  Math.random = originalRandom
  for (let i = 0; i < 600; i++) world.step(1 / 60)
  for (const { mesh, body } of toys) {
    syncToy(mesh, body)
    assert.ok(body.position.y > 1.4 && body.position.y < 4)
    assert.ok(Math.abs(body.position.x) < 1.8 && Math.abs(body.position.z) < 1.5)
    assert.ok(Number.isFinite(mesh.position.y))
    assert.ok(body.velocity.length() < 1)
  }
  assert.ok(toys.some(({ body }) => body.position.y > 2.1), 'dolls stack on one another')
  assert.ok(toys.some(({ mesh }) => Math.abs(mesh.rotation.x) > .4 || Math.abs(mesh.rotation.z) > .4), 'dolls rotate rather than all sitting upright')
})

test('won dolls are retained and new shelf rows are added', () => {
  const { game } = fixture(.1)
  cycle(game)
  const firstPrize = game.collection[0]
  for (let i = 0; i < 5; i++) {
    const toy = { mesh: new THREE.Group() }
    game.toys.push(toy); game.displayPrize(toy)
  }
  assert.equal(game.collection.length, 6)
  assert.equal(game.collection[0], firstPrize)
  assert.equal(game.shelfRows.size, 2)
  assert.ok(game.collection[5].position.y > firstPrize.position.y)
})
