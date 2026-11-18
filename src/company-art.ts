import * as THREE from 'three'
import { companyStations, type CompanyPlayer } from './company-data.ts'
export { companyStations, type CompanyPlayer, type CompanyBoss, type StationKey } from './company-data.ts'
export const shirts = ['#7953e6', '#fc795d', '#38a3bb', '#f0bb42', '#f278a4', '#4587e1', '#59a278', '#dc6266']
const skins = ['#f5cba8', '#e3ad81', '#ba805d', '#f6dec5']
const sphere = new THREE.SphereGeometry(1, 20, 14)
export const mat = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: .75 })
export function ellipsoid(parent: THREE.Object3D, color: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) { const m = new THREE.Mesh(sphere, color); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
export function block(parent: THREE.Object3D, color: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), color); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
export function textSprite(text: string, color = '#564c64', bg = '#ffffff', width = 2) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128
  const ctx = c.getContext('2d')!; ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(3, 3, 506, 122, 40); ctx.fill(); ctx.font = 'bold 38px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 256, 65, 470)
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false })); sprite.scale.set(width, width / 4, 1); return sprite
}
export function makeAvatar(p: CompanyPlayer, boss = false) {
  const group = new THREE.Group(), skin = mat(skins[p.skin]!), shirt = mat(boss ? '#41495c' : shirts[p.shirt]!), ink = mat('#342b34')
  const torso = ellipsoid(group, shirt, 0, .56, 0, .3, .32, .23)
  const head = new THREE.Group(); head.position.y = 1.12; group.add(head)
  const faceMaterial = skin.clone()
  ellipsoid(head, faceMaterial, 0, 0, 0, .47, .46, .4)
  const brows: THREE.Mesh[] = []
  for (const side of [-1, 1]) {
    ellipsoid(head, skin, side * .44, -.02, 0, .09, .12, .08)
    ellipsoid(head, ink, side * .16, .02, .365, .038, .055, .02)
    ellipsoid(head, mat('#ed8d9a'), side * .25, -.12, .34, .065, .04, .02)
    const brow = block(head, ink, side * .16, .15, .36, .13, .025, .025); brow.rotation.z = boss ? side * .45 : side * -.1; brows.push(brow)
  }
  const hair = mat(['#423136', '#77533a', '#292c3b', '#ac7b42'][p.hair]!)
  const hairGroup = new THREE.Group(); head.add(hairGroup)
  const steam = new THREE.Group(); steam.position.y = .46; steam.visible = false; head.add(steam)
  if (!boss) { ellipsoid(hairGroup, hair, 0, .3, -.03, .46, .21, .36); for (let i = 0; i < 3; i++) ellipsoid(hairGroup, hair, -.25 + i * .2, .27, .29, .12, .12 + p.hair * .015, .1) }
  else {
    ellipsoid(hairGroup, hair, 0, .35, -.16, .4, .13, .22)
    for (let i = 0; i < 5; i++) {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(.07, .17, 7), hair)
      tuft.position.set((i - 2) * .12, .48, -.16); tuft.rotation.z = (2 - i) * .14; hairGroup.add(tuft)
    }
    const vapor = new THREE.MeshBasicMaterial({ color: '#fff7e9', transparent: true, opacity: .7, depthWrite: false })
    for (let i = 0; i < 8; i++) ellipsoid(steam, vapor, i % 2 ? -.37 : .37, 0, 0, .06, .08, .06)
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.065, .012, 6, 16, Math.PI), ink); mouth.position.set(0, -.16, .38); mouth.rotation.z = boss ? 0 : Math.PI; head.add(mouth)
  const arms: THREE.Group[] = [], legs: THREE.Group[] = []
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * .29, .72, 0); group.add(arm); ellipsoid(arm, shirt, side * .045, -.12, 0, .1, .18, .1); ellipsoid(arm, skin, side * .05, -.28, .01, .085, .08, .08); arms.push(arm)
    const leg = new THREE.Group(); leg.position.set(side * .14, .32, 0); group.add(leg); ellipsoid(leg, mat('#394862'), 0, -.14, 0, .1, .18, .1); ellipsoid(leg, mat('#faf8ee'), 0, -.27, .055, .11, .075, .16); legs.push(leg)
  }
  if (p.outfit === 0 || boss) { const tie = block(group, mat('#ffd45c'), 0, .64, .225, .07, .27, .02); tie.rotation.z = -.08 }
  if (p.outfit === 1) for (let i = 0; i < 3; i++) block(group, mat('#fff5e7'), 0, .44 + i * .09, .217, .44, .025, .012)
  if (p.outfit === 2) { const badge = block(group, mat('#fff4df'), .12, .65, .23, .12, .13, .025); badge.rotation.z = .15 }
  const label = textSprite(p.nickname, '#655671', '#ffffff', 1.8); label.position.y = 1.86; group.add(label)
  return { group, torso, head, arms, legs, label, faceMaterial, hairGroup, steam, brows, mouth }
}
export function buildOffice(scene: THREE.Scene) {
  const cream = mat('#f4eedf'), wood = mat('#cda786'), metal = mat('#657485'), white = mat('#fffaf4'), dark = mat('#283c51')
  block(scene, cream, 0, -.16, 0, 18, .3, 14)
  const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(18, .1, 14)), new THREE.LineBasicMaterial({ color: '#beaebc' })); scene.add(border)
  for (let i = 0; i < 6; i++) block(scene, mat('#d8cfbd'), 0, .005, -5.5 + i * 2, .08, .01, .7)
  for (const [key, s] of Object.entries(companyStations)) {
    block(scene, mat(s.color), s.x, .015, s.z, 7.1, .035, 4.5)
    for (let slot = 0; slot < 4; slot++) {
      const x = s.x + (slot - 1.5) * 1.15, z = s.z
      if (key === 'desk') {
        block(scene, wood, x, .83, z, 1.05, .12, .85); block(scene, metal, x, .4, z, .12, .8, .12)
        block(scene, dark, x, 1.25, z -.13, .72, .48, .08); block(scene, mat('#86c9d5'), x, 1.25, z -.08, .63, .36, .015)
        block(scene, metal, x, 1.04, z -.13, .06, .3, .06); block(scene, dark, x + .4, .5, z, .2, .6, .4)
        block(scene, mat('#dce9ee'), x, .91, z + .25, .55, .035, .19)
      }
      if (key === 'printer') {
        block(scene, white, x, .55, z + .15, 1, 1.1, .85); block(scene, dark, x, 1.14, z + .15, .9, .07, .75)
        block(scene, mat('#7fd0dc'), x, 1.18, z + .15, .72, .015, .57); block(scene, dark, x, .68, z + .59, .7, .1, .02)
        for (let line = 0; line < 3; line++) block(scene, metal, x, .27 + line * .15, z + .59, .82, .02, .025)
      }
      if (key === 'toilet') {
        ellipsoid(scene, white, x, .41, z + .85, .43, .3, .48); block(scene, white, x, .76, z + .45, .63, .85, .22)
        const seat = new THREE.Mesh(new THREE.TorusGeometry(.3, .07, 8, 30), mat('#d7d2ed')); seat.rotation.x = Math.PI / 2; seat.position.set(x, .66, z + .85); scene.add(seat)
        if (slot === 0 || slot === 3) block(scene, mat('#9c91c4'), x + (slot === 0 ? -.58 : .58), .7, z + .4, .05, 1.4, 1.7)
      }
      if (key === 'desk' || key === 'boss') { block(scene, mat('#686ea0'), x, .43, z + .9, .66, .13, .6); block(scene, mat('#686ea0'), x, .78, z + 1.18, .66, .7, .09); block(scene, metal, x, .2, z + .9, .1, .4, .1) }
    }
    if (key === 'boss') {
      block(scene, wood, s.x, .85, s.z - .55, 3, .14, .9); block(scene, metal, s.x, .4, s.z - .55, .2, .8, .2)
      const chair = mat('#424259')
      block(scene, chair, s.x, .58, s.z - 1.3, .8, .12, .7)
      block(scene, chair, s.x, .98, s.z - 1.62, .8, .85, .12)
      block(scene, metal, s.x, .28, s.z - 1.3, .14, .56, .14)
    }
  }
  for (const [x, z] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) { block(scene, mat('#b58f73'), x!, .25, z!, .5, .5, .5); ellipsoid(scene, mat('#65a77b'), x!, .85, z!, .45, .55, .45) }
  const welcome = textSprite('회사 · 오늘도 갓생', '#796783', '#fffaf2', 3.4); welcome.position.set(0, .25, 0); welcome.material.depthTest = true; scene.add(welcome)
}
export function facePrint(p: CompanyPlayer) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fffef4'; ctx.fillRect(0, 0, 128, 128); ctx.save(); ctx.translate(64, 58); ctx.rotate([0, -.3, .3, Math.PI][p.pose]!)
  ctx.fillStyle = skins[p.skin]!; ctx.beginPath(); ctx.ellipse(0, 0, 37, 36, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#332e36'
  for (const x of [-13, 13]) { ctx.beginPath(); ctx.arc(x, -3, 4, 0, Math.PI * 2); ctx.fill() }
  ctx.strokeStyle = '#332e36'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 10, 8, 0, Math.PI); ctx.stroke(); ctx.restore(); ctx.fillStyle = shirts[p.shirt]!; ctx.fillRect(25, 103, 78, 8)
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; return texture
}
