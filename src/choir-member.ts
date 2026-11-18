import * as THREE from 'three'

const sphere = new THREE.SphereGeometry(1, 20, 14)
const material = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: .8 })
function ball(parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const mesh = new THREE.Mesh(sphere, mat); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh
}
export function createChoirMember(index: number) {
  const group = new THREE.Group(), skin = material(['#f6d6b8', '#e9b68f', '#c9916e', '#f6e3ce'][index % 4]!), robe = material(index % 2 ? '#d77b76' : '#698e91'), hair = material(['#473238', '#71513d', '#2d303d', '#95653f'][index % 4]!), ink = material('#352a34')
  const head = new THREE.Group(); head.position.y = 1.13; group.add(head)
  ball(head, skin, 0, 0, 0, .42, .43, .36)
  const brows: THREE.Mesh[] = [], eyes: THREE.Group[] = []
  for (const side of [-1, 1]) {
    ball(head, skin, side * .4, -.02, 0, .075, .1, .07)
    const eye = new THREE.Group(); eye.position.set(side * .14, .015, .338); head.add(eye); eyes.push(eye)
    ball(eye, ink, 0, 0, 0, .03, .045, .018)
    ball(eye, material('#fff9ed'), -.008, .013, .014, .009, .012, .006)
    brows.push(ball(head, ink, side * .14, .115, .343, .075, .013, .016))
    ball(head, material('#edaaa6'), side * .24, -.11, .3, .06, .032, .018)
  }
  ball(head, hair, 0, .29, -.025, .42, .2, .33)
  for (let i = 0; i < 3; i++) ball(head, hair, -.23 + i * .2, .27, .245, .12, .12 + index % 3 * .012, .08)
  if (index % 3 === 1) for (const side of [-1, 1]) ball(head, hair, side * .4, .15, -.06, .13, .15, .13)
  const mouth = ball(head, material('#6a343d'), 0, -.16, .345, .075, .01, .015)
  const corners = [-1, 1].map(side => ball(head, ink, side * .075, -.16, .345, .019, .009, .013))
  ball(group, robe, 0, .52, 0, .31, .36, .24)
  const collar = new THREE.Mesh(new THREE.ConeGeometry(.23, .28, 3), material('#fff4da')); collar.rotation.z = Math.PI; collar.position.set(0, .7, .17); collar.scale.z = .14; group.add(collar)
  const arms: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * .28, .72, 0); group.add(arm)
    ball(arm, robe, side * .03, -.14, 0, .1, .2, .1); ball(arm, skin, side * .035, -.3, .02, .075, .075, .075); arms.push(arm)
    ball(group, material('#374153'), side * .13, .15, .02, .095, .19, .1); ball(group, material('#fff7e8'), side * .13, .035, .08, .11, .065, .15)
  }
  const baseX = (index - 1.5) * 2.3, baseY = .2
  group.position.set(baseX, baseY, 0)
  return { group, head, mouth, brows, eyes, corners, arms, baseX, baseY, frown: 0, sad: 0 }
}
export type ChoirMember = ReturnType<typeof createChoirMember>
export function animateChoirMember(member: ChoirMember, index: number, dt: number, time: number, phase: number, singing: boolean, good: boolean, songTime: number, scolded: number) {
  const sad = scolded === index, angry = scolded >= 0 && !sad
  member.sad = THREE.MathUtils.damp(member.sad, sad ? 1 : 0, 7, dt)
  member.frown = THREE.MathUtils.damp(member.frown, !sad && (angry || singing && !good) ? 1 : 0, 8, dt)
  const sway = singing ? Math.sin(phase * Math.PI) * .23 * (1 - member.sad * .65) : Math.sin(time / 1600 + index) * .009
  member.group.rotation.z = sway
  member.group.position.x = member.baseX + (singing ? Math.sin(phase * Math.PI) * .16 : 0)
  member.group.position.y = member.baseY + (singing ? Math.abs(Math.sin(phase * Math.PI * 2)) * .025 : 0) - member.sad * .055
  member.head.rotation.z = -sway * .3 + member.frown * Math.sin(time / 85) * .025
  member.head.rotation.x = THREE.MathUtils.damp(member.head.rotation.x, member.sad * .35, 8, dt)
  const look = angry ? Math.sign(scolded - index) * .5 : 0
  member.head.rotation.y = THREE.MathUtils.damp(member.head.rotation.y, look, 8, dt)
  member.head.position.y = 1.13 - member.sad * .055
  const syllable = .4 + Math.abs(Math.sin(songTime * 11.5 + index * .08)) * .6
  member.mouth.scale.y = THREE.MathUtils.damp(member.mouth.scale.y, singing ? (.035 + syllable * .065) * (1 - member.frown * .35) : .006, 18, dt)
  member.mouth.scale.x = THREE.MathUtils.damp(member.mouth.scale.x, .075 + member.frown * .022 - member.sad * .02, 8, dt)
  member.mouth.rotation.z = member.frown * Math.sin(time / 65) * .06
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1
    member.brows[i]!.rotation.z = side * (member.frown * .48 - member.sad * .48)
    member.brows[i]!.position.y = .115 - member.frown * .03 + member.sad * .008
    member.eyes[i]!.scale.y = 1 - member.frown * .72 - member.sad * .35
    member.eyes[i]!.rotation.z = side * member.frown * .2
    member.corners[i]!.position.y = -.16 - member.frown * .025 - member.sad * .02
    member.corners[i]!.rotation.z = -side * (member.frown * .5 + member.sad * .45)
    member.arms[i]!.rotation.z = side * (.15 - member.frown * .22 + member.sad * .1)
    member.arms[i]!.rotation.x = singing ? Math.sin(phase * Math.PI) * .09 * side : 0
  }
}
