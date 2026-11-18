import * as THREE from 'three'

import { preset, type DollOptions } from './claw-doll-data.ts'
export { dollNames, preset, type DollOptions } from './claw-doll-data.ts'
const sphere = new THREE.SphereGeometry(1, 28, 20)
export function ball(parent: THREE.Object3D, mat: THREE.Material, pos: number[], scale: number[]) {
  const mesh = new THREE.Mesh(sphere, mat); mesh.position.set(pos[0]!, pos[1]!, pos[2]!); mesh.scale.set(scale[0]!, scale[1]!, scale[2]!); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh
}
export function fabricTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#909090'; ctx.fillRect(0, 0, 128, 128)
  for (let i = 0; i < 5500; i++) { const v = 80 + Math.random() * 120; ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 2) }
  const texture = new THREE.CanvasTexture(c); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3, 3); return texture
}
function faceTexture(o: DollOptions) {
  const c = document.createElement('canvas'); c.width = c.height = 512
  const ctx = c.getContext('2d')!; const ink = '#322923'
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 9; ctx.lineCap = 'round'
  const curve = (x: number, y: number, cx: number, cy: number, endX: number, endY: number) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(cx, cy, endX, endY); ctx.stroke() }
  for (const side of [-1, 1]) {
    const x = 256 + side * 82
    ctx.fillStyle = '#ed9eaf'; ctx.beginPath(); ctx.ellipse(256 + side * 139, 300, 41, 27, side * .15, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(x, 235, o.eyes === 4 ? 29 : 25, o.eyes === 4 ? 18 : o.eyes === 3 ? 34 : 28, side * -.12, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fffdf5'; ctx.beginPath(); ctx.ellipse(x - 6, 225, 12, o.eyes === 3 ? 9 : 8, -.4, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(x + 6, 245, o.eyes === 3 ? 15 : 6, 4, 0, 0, Math.PI * 2); ctx.fill()
    if (o.brows === 0) curve(x - 30, 179, x - 17, 130, x + 31, 137)
    else if (o.brows === 2) curve(x - 12, 161, x, 173, x + 9, 160)
    else if (o.brows === 4) curve(x - 15, 168, x, 151, x + 15, 168)
    else { ctx.fillStyle = ink; ctx.beginPath(); ctx.ellipse(x, 174, 5, 3, side * -.3, 0, Math.PI * 2); ctx.fill() }
    ctx.lineWidth = 5
    for (let i = 0; i < 3; i++) curve(256 + side * 139 - 13 + i * 12, 296, 256 + side * 139 - 18 + i * 12, 301, 256 + side * 139 - 20 + i * 12, 306)
    ctx.lineWidth = 9
  }
  ctx.fillStyle = o.nose === 3 ? '#b6deea' : ink
  ctx.beginPath(); ctx.ellipse(256, o.nose === 3 ? 272 : 292, o.nose === 3 ? 18 : 7, o.nose === 3 ? 22 : 5, 0, 0, Math.PI * 2); ctx.fill()
  curve(231, 307, 243, 325, 256, 306); curve(256, 306, 269, 325, 281, 307)
  if (o.mouth === 1) { curve(245, 320, 256, 366, 268, 320) }
  else if (o.mouth === 0) curve(256, 320, 252, 352, 272, 343)
  else curve(250, 340, 256, 347, 263, 339)
  if (o.mole) { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(302, 334, 4, 0, Math.PI * 2); ctx.fill() }
  if (o.photo) { ctx.save(); ctx.beginPath(); ctx.roundRect(140, 110, 232, 300, 45); ctx.clip(); const ratio = Math.max(232 / o.photo.width, 300 / o.photo.height); ctx.drawImage(o.photo, 256 - o.photo.width * ratio / 2, 260 - o.photo.height * ratio / 2, o.photo.width * ratio, o.photo.height * ratio); ctx.restore() }
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; return texture
}
export function makeDoll(o: DollOptions, bump: THREE.Texture) {
  const group = new THREE.Group()
  const body = new THREE.MeshPhysicalMaterial({ color: o.color, roughness: .95, bumpMap: bump, bumpScale: .018, sheen: .45, sheenRoughness: .9, sheenColor: '#fff7ed' })
  const blue = body.clone(); blue.color.set('#3298ed')
  const pink = body.clone(); pink.color.set('#fa79aa')
  const dark = new THREE.MeshStandardMaterial({ color: '#372c29', roughness: .75 })
  ball(group, body, [0, .28, 0], [.36, .39, .28])
  ball(group, body, [0, .69, 0], [.46, .39, .31])
  for (const side of [-1, 1]) {
    ball(group, body, [side * .32, .24, .02], [.12, .18, .12]).rotation.z = side * -.3
    ball(group, body, [side * .16, -.02, .09], [.13, .11, .16])
    const ear = ball(group, o.ears === 1 ? blue : body, [side * .24, o.ears === 0 ? 1.24 : 1.04, -.015], [o.ears === 0 ? .09 : .12, o.ears === 0 ? .35 : .16, .09])
    ear.rotation.z = side * -.16
    if (o.ears === 0 || o.ears === 3) { const inner = ball(group, o.ears === 3 ? blue : pink, [side * .24, o.ears === 0 ? 1.24 : 1.06, .07], [.055, o.ears === 0 ? .27 : .09, .018]); inner.rotation.z = side * -.16 }
  }
  if (o.base === 1) {
    for (const side of [-1, 1]) ball(group, blue, [side * .23, .96, .04], [.23, .13, .27]).rotation.z = side * .2
    ball(group, blue, [.31, .14, -.24], [.12, .11, .3]).rotation.y = -.6
  }
  if (o.base === 3) ball(group, blue, [.41, .45, -.22], [.25, .45, .15]).rotation.z = -.5
  if (o.base === 4) {
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(.3, .075, 12, 32), new THREE.MeshStandardMaterial({ color: '#faf8ed' })); scarf.rotation.x = Math.PI / 2; scarf.position.y = .35; group.add(scarf)
    ball(group, dark, [0, .31, .3], [.1, .045, .035])
  }
  if (o.pattern !== 'plain') {
    for (let i = 0; i < 9; i++) {
      const x = (i % 3 - 1) * .16, y = .15 + Math.floor(i / 3) * .11
      ball(group, o.pattern === 'dots' ? pink : blue, [x, y, .25], o.pattern === 'dots' ? [.026, .026, .012] : [.06, .014, .012])
    }
  }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.83, .83, 20, 20), new THREE.MeshStandardMaterial({ map: faceTexture(o), transparent: true, depthWrite: false, roughness: .95, polygonOffset: true, polygonOffsetFactor: -1 }))
  const positions = face.geometry.attributes.position!
  for (let i = 0; i < positions.count; i++) { const x = positions.getX(i), y = positions.getY(i); positions.setZ(i, .316 * Math.sqrt(Math.max(.02, 1 - (x / .47) ** 2 - (y / .41) ** 2))) }
  face.geometry.computeVertexNormals(); face.position.y = .69; group.add(face)
  if (o.glasses) {
    const metal = new THREE.MeshStandardMaterial({ color: '#544441', metalness: .7, roughness: .2 })
    for (const side of [-1, 1]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(.105, .012, 8, 32), metal); ring.position.set(side * .135, .72, .31); group.add(ring) }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(.07, .014, .014), metal); bridge.position.set(0, .73, .32); group.add(bridge)
  }
  if (o.piercing) { const ring = new THREE.Mesh(new THREE.TorusGeometry(.055, .012, 8, 24), new THREE.MeshStandardMaterial({ color: '#ddb66c', metalness: .9, roughness: .18 })); ring.position.set(-.29, 1.02, .1); group.add(ring) }
  return group
}
// Shared sphere and bump map belong to the scene, not individual dolls.
export function disposeDoll(group: THREE.Group) {
  group.traverse(object => { if (object instanceof THREE.Mesh) { if (object.geometry !== sphere) object.geometry.dispose(); const mats = Array.isArray(object.material) ? object.material : [object.material]; for (const mat of mats) { if (mat instanceof THREE.MeshStandardMaterial) mat.map?.dispose(); mat.dispose() } } })
}

export function featureThumbnail(feature: string, index: number) {
  const texture = faceTexture(preset(index))
  const source = texture.image as HTMLCanvasElement
  const crop: Record<string, number[]> = { eyes: [115, 194, 280, 80], brows: [110, 116, 290, 70], nose: [228, 245, 56, 60], mouth: [217, 296, 80, 65] }
  const [x, y, width, height] = crop[feature] ?? [0, 0, 512, 512]
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 120
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fffaf1'; ctx.fillRect(0, 0, 160, 120)
  const scale = Math.min(140 / width!, 90 / height!)
  ctx.drawImage(source, x!, y!, width!, height!, (160 - width! * scale) / 2, (120 - height! * scale) / 2, width! * scale, height! * scale)
  texture.dispose(); return canvas.toDataURL()
}
