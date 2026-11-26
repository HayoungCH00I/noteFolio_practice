import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ballAt, personAt, personContact, personCutout, readCaptures } from '../src/trainer-core.ts'
import { pageFromHash, weekForPage } from '../src/pages.ts'

test('a flick travels upward and checks the same mirrored, cropped coordinates as the video', () => {
  const mask = { width: 4, height: 4, data: new Uint8Array(16) }
  mask.data[4] = 1
  const origin = { x: 100, y: 295 }
  const point = ballAt(origin, { x: 72, y: -170 }, 400, .5)
  assert.deepEqual(point, { x: 172, y: 77 })
  assert.equal(personAt(mask, point, 400, 400, 200, 400), false)
  const hitPoint = { x: 180, y: 150 }
  assert.equal(personAt(mask, hitPoint, 250, 400, 200, 400), true)
  assert.equal(personAt(mask, { x: 20, y: 150 }, 250, 400, 200, 400), false)
  assert.equal(personAt(mask, hitPoint, 250, 400, 200, 400, 0, false), false)
  assert.equal(personAt(mask, { x: 20, y: 150 }, 250, 400, 200, 400, 0, false), true)
})

test('the edge of the ball can hit any visible part of a mirrored person mask', () => {
  const mask = { width: 20, height: 20, data: new Uint8Array(400) }
  for (const [col, row] of [[14, 4], [11, 10], [7, 15]]) {
    mask.data[row * mask.width + col] = 1
    // Place the center in the background just outside this foreground cell.
    const point = { x: 300 - (col + 1.25) * 20, y: (row + .5) * 20 }
    assert.equal(personAt(mask, point, 400, 400, 200, 400), false)
    assert.equal(personAt(mask, point, 400, 400, 200, 400, 12), true)
  }
  assert.equal(personAt(mask, { x: 75, y: 17 }, 400, 400, 200, 400, 12), false)
})
test('the inventory restores embedded photos, keeps legacy captures and ignores remote image URLs', () => {
  const record = { name: '인간1', date: '2026-11-19T00:00:00.000Z' }
  const withPhoto = { ...record, name: '인간2', photo: 'data:image/webp;base64,UklGRg==' }
  const remote = { ...record, name: '인간3', photo: 'https://example.invalid/portrait.webp' }
  assert.deepEqual(readCaptures(JSON.stringify([record, withPhoto, remote, null, { name: 2 }])), [record, withPhoto, { ...record, name: '인간3' }])
  assert.deepEqual(readCaptures('broken'), [])
})
test('the first hit selects only the connected person it touched', () => {
  const mask = { width: 7, height: 4, data: Uint8Array.from([
    0, 1, 0, 0, 0, 1, 0,
    1, 1, 1, 0, 1, 1, 1,
    0, 1, 0, 0, 0, 1, 0,
    1, 0, 1, 0, 1, 0, 1,
  ]) }
  const point = { x: 31, y: 15 }
  const hit = personContact(mask, point, 70, 40, 70, 40, 2, true)
  assert.equal(hit, 11)
  const { pixels, x, y, width, height } = personCutout(mask, hit)
  assert.deepEqual([x, y, width, height], [4, 0, 3, 3])
  assert.equal(pixels[8], 0, 'the other person stays out of the portrait')
  assert.equal(pixels[11], 1)
  assert.equal(pixels[26], 0, 'isolated mask pixels stay out of the portrait')
})
test('the example is available from week four', () => {
  assert.equal(pageFromHash('#fourteenth'), 'fourteenth')
  assert.equal(weekForPage('fourteenth'), '4')
})
