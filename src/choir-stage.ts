import * as THREE from 'three'
import { createChoirMember, animateChoirMember, type ChoirMember } from './choir-member.ts'
type Note = { sprite: THREE.Sprite; life: number; age: number; origin: THREE.Vector3; seed: number; good: boolean }
const material = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: .8 })
function box(parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh }
function noteTexture(symbol: string) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.font = 'bold 78px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(symbol, 48, 53)
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture
}
export class ChoirStage {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(38, 1, .1, 60)
  private renderer: THREE.WebGLRenderer
  private members: ChoirMember[] = []
  private notes: Note[] = []
  private nextNote = 0
  private emission = 0
  private width = 1
  private height = 1
  private projected = new THREE.Vector3()
  private focus = new THREE.Mesh(new THREE.TorusGeometry(.5, .025, 6, 32), new THREE.MeshBasicMaterial({ color: '#ffe290', transparent: true, opacity: .9 }))
  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    host.append(this.renderer.domElement)
    this.scene.add(new THREE.HemisphereLight('#fff2df', '#7c8d98', 2))
    const key = new THREE.DirectionalLight('#fff3dd', 2.7); key.position.set(-4, 10, 7); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 }); key.shadow.normalBias = .025; this.scene.add(key)
    const wood = material('#b78354'), edge = material('#77513d')
    box(this.scene, wood, 0, .08, 0, 10.4, .24, 2.1)
    for (let i = -11; i <= 11; i++) box(this.scene, edge, i * .43, .203, 0, .008, .006, 2.1)
    for (let i = 0; i < 4; i++) { const member = createChoirMember(i); this.members.push(member); this.scene.add(member.group) }
    this.focus.visible = false; this.scene.add(this.focus)
    const textures = ['♪', '♫', '♩'].map(noteTexture)
    for (let i = 0; i < 48; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textures[i % 3], color: '#9cddbf', transparent: true, depthWrite: false })); sprite.visible = false; sprite.scale.set(.5, .5, 1); this.scene.add(sprite)
      this.notes.push({ sprite, life: 0, age: 0, origin: new THREE.Vector3(), seed: i * 1.7, good: true })
    }
  }
  resize(width: number, height: number) {
    if (!width || !height) return
    this.width = width; this.height = height; this.renderer.setSize(width, height); this.camera.aspect = width / height
    const distance = Math.max(6.5, 5.6 / (Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect))
    this.camera.position.set(0, 2.8, distance); this.camera.lookAt(0, 1, 0); this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld()
  }
  memberAt(x: number, y: number) {
    let nearest = -1, distance = Infinity
    for (let i = 0; i < this.members.length; i++) {
      const member = this.members[i]!
      member.head.getWorldPosition(this.projected).project(this.camera)
      const px = (this.projected.x + 1) * this.width / 2, py = (1 - this.projected.y) * this.height / 2
      const d = Math.hypot(x - px, y - py)
      const radius = Math.min(this.width / 8, this.height / 5)
      if (d < radius && d < distance) { nearest = i; distance = d }
    }
    return nearest
  }
  update(dt: number, time: number, phase: number, singing: boolean, good: boolean, songTime: number, scolded = -1, selected = -1) {
    for (let i = 0; i < this.members.length; i++) animateChoirMember(this.members[i]!, i, dt, time, phase, singing, good, songTime, scolded)
    this.focus.visible = selected >= 0 && selected < this.members.length
    if (this.focus.visible) { this.members[selected]!.head.getWorldPosition(this.focus.position); this.focus.position.z += .4; this.focus.quaternion.copy(this.camera.quaternion) }
    if (singing) {
      this.emission += dt * 18
      while (this.emission >= 1) {
        this.emission--
        const note = this.notes[this.nextNote++ % this.notes.length]!, member = this.members[this.nextNote % this.members.length]!
        member.mouth.getWorldPosition(note.origin); note.age = 0; note.life = 2.2; note.good = good; note.sprite.material.color.set(good ? '#a1dfc5' : '#f39a8a'); note.sprite.visible = true
      }
    }
    for (const note of this.notes) {
      if (!note.life) continue
      note.age += dt; note.life = Math.max(0, note.life - dt); note.sprite.visible = note.life > 0
      const jitter = note.good ? 0 : Math.sin(time / 28 + note.seed) * .09
      note.sprite.position.set(note.origin.x + Math.sin(note.age * 1.6 + note.seed) * .13 + jitter, note.origin.y + note.age * .55 + (note.good ? 0 : Math.cos(time / 32 + note.seed) * .035), note.origin.z + .15)
      note.sprite.material.opacity = Math.min(1, note.life * 2); note.sprite.material.rotation = note.good ? Math.sin(note.age) * .1 : Math.sin(time / 35 + note.seed) * .45
    }
    this.renderer.render(this.scene, this.camera)
  }
}
