import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { followCompanyCamera } from '../src/company-camera.ts'

test('following the character preserves zoom and viewing direction', () => {
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(0, 8.5, 10.5)
  const target = new THREE.Vector3(0, .9, 0)
  const offset = camera.position.clone().sub(target)
  followCompanyCamera(camera, target, new THREE.Vector3(5, .38, 3), .016, true)
  assert.ok(target.distanceTo(new THREE.Vector3(5, 1.28, 3)) < 1e-9)
  assert.ok(camera.position.clone().sub(target).distanceTo(offset) < 1e-9)
})
test('camera smoothly catches up rather than jumping on movement', () => {
  const camera = new THREE.PerspectiveCamera(), target = new THREE.Vector3(0, .9, 0)
  camera.position.set(0, 8.5, 10.5)
  const position = new THREE.Vector3(5, 0, 0)
  followCompanyCamera(camera, target, position, 1 / 60)
  assert.ok(target.x > 0 && target.x < 1)
  for (let i = 0; i < 120; i++) followCompanyCamera(camera, target, position, 1 / 60)
  assert.ok(Math.abs(target.x - 5) < .001)
})
test('following does not undo a manually chosen zoom level', () => {
  const camera = new THREE.PerspectiveCamera(), target = new THREE.Vector3(0, .9, 0)
  camera.position.set(0, 4, 5)
  const zoomDistance = camera.position.distanceTo(target)
  followCompanyCamera(camera, target, new THREE.Vector3(-3, 0, 2), .02)
  assert.ok(Math.abs(camera.position.distanceTo(target) - zoomDistance) < 1e-9)
})
