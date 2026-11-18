import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createChoirMember, animateChoirMember } from '../src/choir-member.ts'
function animate(member, index = 0, good = true, scolded = -1, singing = true) {
  for (let i = 0; i < 40; i++) animateChoirMember(member, index, .025, i * 25, .5, singing, good, i * .025, scolded)
}
test('a poor chorus frowns, squints and tightens the mouth while continuing to sing; good timing relaxes it', () => {
  const member = createChoirMember(0); animate(member, 0, false)
  assert.ok(member.frown > .95); assert.ok(member.brows[0].rotation.z < -.4); assert.ok(member.brows[1].rotation.z > .4)
  assert.ok(member.eyes[0].scale.y < .35); assert.ok(member.mouth.scale.y > .02); assert.ok(member.mouth.scale.x > .09)
  animate(member, 0, true); assert.ok(member.frown < .01); assert.ok(member.eyes[0].scale.y > .99)
})
test('a scolded singer droops and keeps singing while the others frown and turn toward them', () => {
  const sad = createChoirMember(2), other = createChoirMember(0)
  animate(sad, 2, true, 2); animate(other, 0, true, 2)
  assert.ok(sad.sad > .95); assert.ok(sad.head.rotation.x > .3); assert.ok(sad.head.position.y < 1.1)
  assert.ok(sad.mouth.scale.y > .02); assert.ok(sad.brows[0].rotation.z > .4)
  assert.ok(other.head.rotation.y > .45); assert.ok(other.frown > .95)
  animate(sad, 2); assert.ok(sad.sad < .01)
})
test('four singers occupy a single row with more room between them and stronger swaying', () => {
  const members = Array.from({ length: 4 }, (_, index) => createChoirMember(index))
  assert.ok(members.every(member => member.group.position.z === 0))
  assert.ok(members[1].baseX - members[0].baseX > 2.1)
  animate(members[0]); assert.ok(Math.abs(members[0].group.rotation.z) > .2)
})
