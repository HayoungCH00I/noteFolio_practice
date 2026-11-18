import * as CANNON from 'cannon-es'
import * as THREE from 'three'

export function createClawWorld() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0), allowSleep: true })
  world.defaultContactMaterial.friction = .65
  world.defaultContactMaterial.restitution = .05
  const wall = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)), position: new CANNON.Vec3(x, y, z) }); world.addBody(body)
  }
  wall(0, 1.25, 0, 3.5, .16, 2.9)
  wall(-1.8, 3, 0, .1, 4, 3); wall(1.8, 3, 0, .1, 4, 3)
  wall(0, 3, -1.5, 3.6, 4, .1); wall(0, 3, 1.5, 3.6, 4, .1)
  return world
}
export function createToyBody(mesh: THREE.Group, world: CANNON.World) {
  const body = new CANNON.Body({ mass: .3, linearDamping: .3, angularDamping: .55, sleepSpeedLimit: .08, sleepTimeLimit: .7 })
  body.addShape(new CANNON.Sphere(.34), new CANNON.Vec3(0, -.17, 0))
  body.addShape(new CANNON.Sphere(.39), new CANNON.Vec3(0, .24, 0))
  body.addShape(new CANNON.Sphere(.13), new CANNON.Vec3(-.34, -.2, 0))
  body.addShape(new CANNON.Sphere(.13), new CANNON.Vec3(.34, -.2, 0))
  body.position.set(mesh.position.x, mesh.position.y + .45, mesh.position.z)
  const poses = [Math.PI / 2, -Math.PI / 2, Math.PI / 3, -Math.PI / 3, 0]
  body.quaternion.setFromEuler(poses[Math.floor(Math.random() * poses.length)]!, Math.random() * Math.PI * 2, (Math.random() - .5) * 1.8)
  world.addBody(body); return body
}
export function syncToy(mesh: THREE.Group, body: CANNON.Body) {
  mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w)
  const offset = new THREE.Vector3(0, .45, 0).applyQuaternion(mesh.quaternion)
  mesh.position.set(body.position.x - offset.x, body.position.y - offset.y, body.position.z - offset.z)
}
export function releaseToy(body: CANNON.Body) {
  body.type = CANNON.Body.DYNAMIC; body.updateMassProperties(); body.wakeUp()
  body.angularVelocity.set(.7, .2, -.4)
}
