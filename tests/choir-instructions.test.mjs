import { test } from 'node:test'
import assert from 'node:assert/strict'
import { choirInstruction } from '../src/choir-instructions.ts'

const performing = { cameraNotice: '', musicNotice: '', cameraOn: true, musicReady: true, started: true, ended: false, remaining: 0, paused: false, hasHand: true, singing: true, scolded: -1, selected: -1, beats: 10, matched: 8, motion: 'vertical' }
test('pausing or losing the conducting hand replaces the motion instruction with only the pause notice', () => {
  for (const state of [{ paused: true }, { hasHand: false, singing: false }]) {
    const view = choirInstruction({ ...performing, ...state })
    assert.equal(view.kind, 'paused'); assert.equal(view.text, '노래를 잠시 멈췄어요.')
    assert.doesNotMatch(view.text, /손가락|위아래|오른손/)
  }
})
test('countdown and end notices take priority over pause, selection and normal instructions', () => {
  const countdown = choirInstruction({ ...performing, paused: true, remaining: 3, selected: 2 })
  assert.equal(countdown.kind, 'countdown'); assert.doesNotMatch(countdown.text, /다섯|선택|멈췄/)
  const end = choirInstruction({ ...performing, ended: true, paused: true, remaining: 3 })
  assert.equal(end.kind, 'ended'); assert.match(end.text, /10번 중 8번/)
})
test('camera and audio errors replace gameplay instructions instead of competing with them', () => {
  const camera = choirInstruction({ ...performing, cameraNotice: '카메라 권한을 허용해 주세요.' })
  assert.deepEqual(camera, { kind: 'notice', text: '카메라 권한을 허용해 주세요.' })
  const audio = choirInstruction({ ...performing, musicNotice: '소리 재생을 허용해 주세요.' })
  assert.equal(audio.kind, 'notice'); assert.equal(audio.text, '소리 재생을 허용해 주세요.')
})
test('motion instructions return when singing resumes, while selection and scolding have their own instruction', () => {
  assert.match(choirInstruction(performing).text, /다섯 손가락/)
  assert.match(choirInstruction({ ...performing, motion: 'sweep' }).text, /검지·중지만/)
  assert.match(choirInstruction({ ...performing, selected: 1 }).text, /2번 선택/)
  assert.equal(choirInstruction({ ...performing, scolded: 1, selected: 1 }).kind, 'scolded')
})
test('an automatic invitation names the requested singer before pointing and never replaces pause or error notices', () => {
  const state = { ...performing, scoldTarget: 2 }
  assert.equal(choirInstruction(state).kind, 'scold-prompt')
  assert.match(choirInstruction(state).text, /3번 단원을 검지로 가리킨 뒤 좌우로 흔들어 혼내세요/)
  assert.match(choirInstruction({ ...state, selected: 2 }).text, /3번 단원을 향해 검지를 좌우로/)
  assert.equal(choirInstruction({ ...state, paused: true }).kind, 'paused')
  assert.equal(choirInstruction({ ...state, musicNotice: '음원 오류' }).kind, 'notice')
})
