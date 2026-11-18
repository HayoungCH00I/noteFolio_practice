import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CompanyRoom, stations } from '../server/company-room.mjs'
const enter = (room, player, station) => { Object.assign(player, stations[station]); room.command(player.id, { type: 'use' }, 1000) }
test('join assigns unique outfits, safe nicknames and enforces room capacity', () => {
  const room = new CompanyRoom()
  assert.throws(() => room.join('   '))
  const players = Array.from({ length: 24 }, (_, i) => room.join(`동료${i}`))
  assert.equal(new Set(players.map(p => `${p.shirt}/${p.outfit}`)).size, 24)
  assert.throws(() => room.join('추가 동료'))
  room.remove(players[0].id); assert.equal(room.join('<새 동료>').nickname, '새 동료')
})
test('movement is bounded, normalized and stops after lost input', () => {
  const room = new CompanyRoom(), p = room.join('이동'); p.x = 0; p.z = 0
  room.command(p.id, { type: 'move', x: 50, z: 50 }, 1000); room.step(.1, 1000)
  assert.ok(Math.hypot(p.x, p.z) <= .361)
  const x = p.x; room.step(.1, 2000); assert.equal(p.x, x)
  room.command(p.id, { type: 'move', x: NaN, z: 1 }, 2100); assert.equal(p.lastInput, 1000)
  room.command(p.id, { type: 'move', x: 1, z: 1 }, 3000)
  for (let i = 0; i < 1000; i++) room.step(.1, 3000)
  assert.ok(p.x <= 8.3 && p.z <= 6.3)
})
test('shared seats do not overlap and are released on disconnect', () => {
  const room = new CompanyRoom(), players = Array.from({ length: 5 }, (_, i) => room.join(`동료${i}`))
  for (const p of players) enter(room, p, 'desk')
  assert.equal(new Set(players.slice(0, 4).map(p => p.slot)).size, 4)
  assert.equal(players[4].station, null)
  room.remove(players[0].id); enter(room, players[4], 'desk'); assert.equal(players[4].station, 'desk')
})
test('seated actions complete tasks without going below zero and reset on re-entry', () => {
  const room = new CompanyRoom(), p = room.join('디자이너'); enter(room, p, 'desk')
  for (let i = 1; i <= 7; i++) room.command(p.id, { type: 'action' }, 2000 + i * 300)
  assert.equal(p.tasks, 0)
  room.command(p.id, { type: 'leave' }); enter(room, p, 'desk'); assert.equal(p.tasks, 4)
})
test('printer cycles through four poses and shares state with everyone', () => {
  const room = new CompanyRoom(), p = room.join('복사왕'); enter(room, p, 'printer')
  const poses = []
  for (let i = 0; i < 4; i++) { room.command(p.id, { type: 'action' }, 1000 + i * 300); poses.push(p.pose) }
  assert.deepEqual(poses, [1, 2, 3, 0]); assert.equal(room.snapshot().players[0].pose, 0)
})
test('boss anger increases only inside the timing window', () => {
  const room = new CompanyRoom(), p = room.join('면담'); enter(room, p, 'boss')
  room.command(p.id, { type: 'action' }, 550 * Math.PI / 2); assert.equal(p.anger, 1)
  room.command(p.id, { type: 'action' }, 550 * Math.PI * 1.5); assert.equal(p.anger, 1)
})
test('bathroom laughter is shared, distant interactions and movement while seated are rejected', () => {
  const room = new CompanyRoom(), p = room.join('화캉스')
  p.x = 0; p.z = 0; room.command(p.id, { type: 'use' }); assert.equal(p.station, null)
  enter(room, p, 'toilet'); const x = p.x
  room.command(p.id, { type: 'move', x: 1, z: 1 }, 2000); room.step(.1, 2000); assert.equal(p.x, x)
  room.command(p.id, { type: 'action' }, 2300)
  assert.equal(room.snapshot().players[0].actionAt, 2300); assert.match(p.result, /아하하/)
})

const bossHitAt = index => 550 * (Math.PI / 2 + index * Math.PI * 2)
test('boss repeatedly reaches maximum anger, gives up, and becomes angry again', () => {
  const room = new CompanyRoom(), p = room.join('무한 면담'); enter(room, p, 'boss')
  for (let cycle = 0; cycle < 3; cycle++) {
    for (let level = 1; level <= 5; level++) {
      room.command(p.id, { type: 'action' }, bossHitAt(cycle * 6 + level - 1))
      assert.equal(room.boss.anger, level)
      assert.equal(room.boss.mood, 'angry')
    }
    room.command(p.id, { type: 'action' }, bossHitAt(cycle * 6 + 5))
    assert.equal(room.boss.anger, 0)
    assert.equal(room.boss.mood, 'dejected')
    assert.equal(room.boss.cycles, cycle + 1)
    assert.match(p.result, /포기/)
  }
})
test('missing the timing at maximum does not trigger resignation', () => {
  const room = new CompanyRoom(), p = room.join('타이밍'); enter(room, p, 'boss')
  for (let i = 0; i < 5; i++) room.command(p.id, { type: 'action' }, bossHitAt(i))
  room.command(p.id, { type: 'action' }, bossHitAt(4) + 550 * Math.PI)
  assert.equal(room.boss.anger, 5); assert.equal(room.boss.mood, 'angry')
})
test('boss mood and anger are shared between seated players', () => {
  const room = new CompanyRoom(), a = room.join('동료 A'), b = room.join('동료 B')
  enter(room, a, 'boss'); enter(room, b, 'boss')
  for (let i = 0; i < 5; i++) room.command(a.id, { type: 'action' }, bossHitAt(i))
  assert.equal(b.anger, 5)
  room.command(b.id, { type: 'action' }, bossHitAt(5))
  const snapshot = room.snapshot()
  assert.equal(snapshot.boss.mood, 'dejected')
  assert.ok(snapshot.players.every(p => p.anger === 0))
  room.command(a.id, { type: 'action' }, bossHitAt(6))
  assert.equal(a.anger, 1); assert.equal(b.anger, 1); assert.equal(room.boss.mood, 'angry')
})
