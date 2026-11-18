import * as THREE from 'three'

/** Move the camera and its orbit target together, preserving the user's zoom. */
export function followCompanyCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3, position: THREE.Vector3, dt: number, snap = false) {
  const destination = position.clone().add(new THREE.Vector3(0, .9, 0))
  const delta = destination.sub(target).multiplyScalar(snap ? 1 : 1 - Math.exp(-7 * dt))
  camera.position.add(delta)
  target.add(delta)
}
