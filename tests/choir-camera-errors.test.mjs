import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cameraFailure, trackingFailure, requestChoirCamera } from '../src/choir-camera-errors.ts'

test('camera permissions, absent devices and video playback failures have distinct explanations', () => {
  assert.match(cameraFailure({ name: 'NotAllowedError' }), /기기 설정/)
  assert.match(cameraFailure({ name: 'NotAllowedError' }, true), /영상 재생/)
  assert.match(cameraFailure({ name: 'NotFoundError' }), /카메라 연결/)
})
test('tracking failures preserve both initialization errors and recommend the matching recovery action', () => {
  const error = new AggregateError([new Error('worker unavailable'), new Error('Failed to fetch WASM')])
  assert.match(trackingFailure(error), /인증서/); assert.match(trackingFailure(error), /worker unavailable.*Failed to fetch WASM/)
  assert.match(trackingFailure(new Error('WebGL unavailable')), /하드웨어 가속/)
})
test('unsupported camera constraints retry once with relaxed settings; denied permission is not retried', async () => {
  const constraints = [], stream = {}
  assert.equal(await requestChoirCamera(async value => { constraints.push(value); if (constraints.length === 1) throw { name: 'OverconstrainedError' }; return stream }), stream)
  assert.equal(constraints.length, 2); assert.deepEqual(constraints[1], { video: { facingMode: 'user' }, audio: false })
  let attempts = 0
  await assert.rejects(requestChoirCamera(async () => { attempts++; throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }) }))
  assert.equal(attempts, 1)
})
