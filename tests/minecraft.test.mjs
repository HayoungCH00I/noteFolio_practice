import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hitsCenter, swingDuration, swingMotion } from '../src/minecraft-core.ts'
import { pageFromHash, weekForPage } from '../src/pages.ts'

test('crosshair hits only a fresh person mask at its center', () => {
  const mask = { width: 4, height: 4, data: new Uint8Array(16) }
  mask.data[10] = 1
  assert.equal(hitsCenter(mask, 100), true)
  assert.equal(hitsCenter(mask, 600), false)
  mask.data[10] = 0; mask.data[0] = 1
  assert.equal(hitsCenter(mask, 100), false)
})
test('sword swing returns to rest after the 300 ms motion', () => {
  assert.equal(swingDuration, 300)
  assert.ok(Math.abs(swingMotion(0).x) < 1e-10)
  assert.ok(swingMotion(.25).x < -.35)
  assert.ok(Math.abs(swingMotion(1).x) < 1e-10)
  assert.ok(Math.abs(swingMotion(2).x) < 1e-10)
})
test('MineCraft is available in week four without changing rubber person', () => {
  assert.equal(pageFromHash('#thirteenth'), 'thirteenth')
  assert.equal(weekForPage('thirteenth'), '4')
  assert.equal(weekForPage('twelfth'), '4')
})
