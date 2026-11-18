import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import * as CANNON from 'cannon-es'
import { createClawWorld, createToyBody, syncToy, releaseToy } from './claw-physics.ts'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { ball, makeDoll, preset, fabricTexture, disposeDoll, featureThumbnail, type DollOptions } from './claw-models.ts'

type State = 'ready' | 'down' | 'close' | 'up' | 'travel' | 'release' | 'return'
type Toy = { mesh: THREE.Group; home: THREE.Vector3; vy: number; falling: boolean; prize: boolean; body?: CANNON.Body }
export class ClawGame {
  private world = createClawWorld()
  private orbit?: OrbitControls
  private root: HTMLElement
  private renderer?: THREE.WebGLRenderer
  private previewRenderer?: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(35, 1, .1, 60)
  private previewScene = new THREE.Scene()
  private previewCamera = new THREE.PerspectiveCamera(35, 1, .1, 20)
  private previewDoll?: THREE.Group
  private options = preset(0)
  private bump?: THREE.Texture
  private claw = new THREE.Group()
  private cable?: THREE.Mesh
  private fingers: THREE.Group[] = []
  private carriage?: THREE.Mesh
  private toys: Toy[] = []
  private collection: THREE.Group[] = []
  private shelfRows = new Set<number>()
  private held?: Toy
  private unstable = false
  private state: State = 'ready'
  private elapsed = 0
  private active = false
  private frame = 0
  private last = 0
  private keys = new Set<string>()
  private wins = 0
  private targetY = 2.4
  private photoVersion = 0
  private view: 'angle' | 'front' | 'top' | 'collection' = 'angle'
  private form: HTMLFormElement
  constructor(root: HTMLElement) {
    this.root = root; this.form = root.querySelector('form')!
    window.addEventListener('keydown', event => {
      if (!this.active || (event.target instanceof HTMLElement && event.target.closest('input,select,button'))) return
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) { event.preventDefault(); if (this.state !== 'ready') return; if (event.key === ' ' && !event.repeat) this.drop(); else this.keys.add(event.key) }
    })
    window.addEventListener('keyup', event => this.keys.delete(event.key))
    window.addEventListener('blur', () => this.keys.clear())
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-dir]')) {
      const key = ({ up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as Record<string, string>)[button.dataset.dir!]!
      button.addEventListener('pointerdown', event => { if (this.state !== 'ready') return; button.setPointerCapture(event.pointerId); this.keys.add(key) })
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => this.keys.delete(key))
    }
    root.querySelector('.claw-drop')!.addEventListener('click', () => this.drop())
    root.querySelector('.claw-refill')!.addEventListener('click', () => { if (this.state === 'ready' && this.renderer) this.refill() })
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-view]')) button.addEventListener('click', () => { this.view = button.dataset.view as typeof this.view; this.setView(); this.resize() })
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-zoom]')) button.addEventListener('click', () => {
      if (!this.orbit) return
      const offset = this.camera.position.clone().sub(this.orbit.target)
      offset.setLength(THREE.MathUtils.clamp(offset.length() * (button.dataset.zoom === 'in' ? .8 : 1.25), this.orbit.minDistance, this.orbit.maxDistance))
      this.camera.position.copy(this.orbit.target).add(offset); this.orbit.update()
    })
    this.form.addEventListener('submit', event => { event.preventDefault(); if (!this.renderer || this.state !== 'ready') return; if (this.toys.length >= 14) { this.say('기계가 가득 찼어요. 인형을 먼저 뽑아 주세요.'); return }; this.addToy(this.options); this.say('내 인형이 들어왔어요. 집게를 맞춰 보세요!') })
    this.form.addEventListener('change', event => {
      const input = event.target as HTMLInputElement
      if (input.name === 'photo') { void this.upload(input.files?.[0]); return }
      if (input.name === 'base') {
        this.options = preset(Number(input.value)); this.photoVersion++
        for (const [key, value] of Object.entries(this.options)) { const element = this.form.elements.namedItem(key); if (!element) continue; if (element instanceof RadioNodeList) { element.value = String(value); continue }; if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) continue; if (element.type === 'checkbox') (element as HTMLInputElement).checked = Boolean(value); else element.value = String(value) }
        ;(this.form.elements.namedItem('photo') as HTMLInputElement).value = ''
        root.querySelector<HTMLElement>('.claw-remove-photo')!.hidden = true
      } else if (['mole', 'glasses', 'piercing'].includes(input.name)) Object.assign(this.options, { [input.name]: input.checked })
      else Object.assign(this.options, { [input.name]: ['eyes', 'brows', 'nose', 'mouth', 'ears'].includes(input.name) ? Number(input.value) : input.value })
      this.updatePreview()
    })
    root.querySelector('.claw-remove-photo')!.addEventListener('click', () => { this.photoVersion++; delete this.options.photo; (this.form.elements.namedItem('photo') as HTMLInputElement).value = ''; root.querySelector<HTMLElement>('.claw-remove-photo')!.hidden = true; this.updatePreview() })
    new ResizeObserver(() => this.resize()).observe(root.querySelector('.claw-viewport')!)
  }
  setActive(active: boolean) {
    if (this.active === active) return
    this.active = active; this.keys.clear(); cancelAnimationFrame(this.frame)
    if (!active) return
    if (!this.renderer) { try { this.initialize() } catch { this.say('3D 화면을 열 수 없어요. WebGL을 지원하는 브라우저에서 다시 시도해 주세요.'); return } }
    this.resize(); this.last = 0; this.frame = requestAnimationFrame(this.tick)
  }
  private say(text: string) { this.root.querySelector('.claw-status')!.textContent = text }
  private box(size: number[], position: number[], material: THREE.Material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material); mesh.position.set(position[0]!, position[1]!, position[2]!); mesh.castShadow = true; mesh.receiveShadow = true; this.scene.add(mesh); return mesh
  }
  private initialize() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1
    this.root.querySelector('.claw-viewport')!.append(this.renderer.domElement)
    this.renderer.domElement.addEventListener('pointerdown', () => this.root.querySelector<HTMLElement>('.claw-viewport')!.focus({ preventScroll: true }))
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement); this.orbit.target.set(0, 2.5, 0); this.orbit.enableDamping = true; this.orbit.enablePan = false; this.orbit.minDistance = 5; this.orbit.maxDistance = 20; this.orbit.maxPolarAngle = Math.PI * .82; this.setView()
    const pmrem = new THREE.PMREMGenerator(this.renderer); const room = new RoomEnvironment(); const environment = pmrem.fromScene(room).texture; this.scene.environment = environment; this.scene.environmentIntensity = .35; room.dispose(); pmrem.dispose()
    this.scene.add(new THREE.HemisphereLight('#d5e5ff', '#13152d', .65))
    const light = new THREE.DirectionalLight('#fff5ec', 2.6); light.position.set(3, 9, 5); light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.camera.left = -5; light.shadow.camera.right = 5; light.shadow.camera.top = 7; light.shadow.camera.bottom = -5; light.shadow.normalBias = .02; this.scene.add(light)
    const shell = new THREE.MeshPhysicalMaterial({ color: '#7029f5', roughness: .26, metalness: .3, clearcoat: 1 })
    const cream = new THREE.MeshStandardMaterial({ color: '#172648', roughness: .45 })
    const chrome = new THREE.MeshStandardMaterial({ color: '#d7dbe3', metalness: .95, roughness: .2 })
    const glass = new THREE.MeshPhysicalMaterial({ color: '#d7edf3', transparent: true, opacity: .025, roughness: .02, metalness: 0, depthWrite: false, side: THREE.FrontSide })
    const dark = new THREE.MeshStandardMaterial({ color: '#080b18', roughness: .5 })
    this.box([3.8, .9, 3.2], [0, .65, 0], shell)
    const roof = this.box([3.6, .025, 3], [0, 4.95, 0], glass); roof.castShadow = false; roof.receiveShadow = false
    // The left-front opening is a real gap in the play floor.
    this.box([2.5, .16, 2.9], [.55, 1.25, 0], cream); this.box([1.1, .16, 1.85], [-1.25, 1.25, -.525], cream)
    this.box([.9, .08, .8], [-1.25, 1.12, 1.05], dark)
    const panels = [this.box([.015, 3.6, 3], [-1.79, 3.1, 0], glass), this.box([.015, 3.6, 3], [1.79, 3.1, 0], glass), this.box([3.6, 3.6, .015], [0, 3.1, -1.49], glass), this.box([3.6, 3.6, .015], [0, 3.1, 1.49], glass)]
    for (const panel of [...panels, roof]) {
      panel.castShadow = false; panel.receiveShadow = false
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(panel.geometry), new THREE.LineBasicMaterial({ color: '#52ddff', transparent: true, opacity: .5 })); edge.position.copy(panel.position); this.scene.add(edge)
    }
    this.box([1.05, .58, .04], [-1.18, .67, 1.62], dark)
    this.box([1.12, .08, .55], [-1.18, .34, 1.8], chrome)
    const led = new THREE.MeshStandardMaterial({ color: '#37dfff', emissive: '#14c4ff', emissiveIntensity: 2 })
    for (const x of [-1.62, 1.62]) this.box([.035, 3.35, .035], [x, 3.05, -1.35], led)
    this.box([3.3, .06, .06], [0, 4.65, -.8], chrome); this.box([3.3, .06, .06], [0, 4.65, .8], chrome)
    this.carriage = this.box([.14, .1, 2.75], [0, 4.59, 0], chrome)
    this.claw.position.set(0, 4.3, 0); this.scene.add(this.claw)
    ball(this.claw, chrome, [0, 0, 0], [.16, .14, .16])
    for (let i = 0; i < 3; i++) {
      const swivel = new THREE.Group(); swivel.rotation.y = i * Math.PI * 2 / 3; this.claw.add(swivel)
      const finger = new THREE.Group(); swivel.add(finger); this.fingers.push(finger)
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(.07, 0, 0), new THREE.Vector3(.24, -.24, 0), new THREE.Vector3(.3, -.5, 0), new THREE.Vector3(.17, -.66, 0)])
      finger.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, .026, 8, false), chrome))
    }
    this.cable = this.box([.025, 1, .025], [0, 4.45, 0], dark)
    const floor = this.box([200, .1, 200], [0, -.08, 0], new THREE.MeshStandardMaterial({ color: '#080c1b', roughness: .9 })); floor.castShadow = false
    for (const x of [-1.45, 1.45]) for (const z of [-1.15, 1.15]) this.box([.25, .25, .25], [x, .1, z], dark)
    const rim = new THREE.DirectionalLight('#746bff', 1.4); rim.position.set(-4, 5, -3); this.scene.add(rim)
    this.ensureShelf(0)
    this.bump = fabricTexture(); this.refill()
    this.previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); this.previewRenderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); this.previewRenderer.toneMapping = THREE.ACESFilmicToneMapping
    this.root.querySelector('.claw-preview')!.append(this.previewRenderer.domElement)
    this.previewScene.environment = environment; this.previewScene.environmentIntensity = .35; this.previewScene.add(new THREE.HemisphereLight('#e5eeff', '#18223a', 1.2)); const previewLight = new THREE.DirectionalLight('#fff5e8', 2); previewLight.position.set(2, 3, 4); this.previewScene.add(previewLight)
    this.previewCamera.position.set(0, .9, 3.2); this.previewCamera.lookAt(0, .65, 0); this.buildThumbnails(); this.updatePreview()
  }
  private resize() {
    if (!this.renderer || !this.active) return
    const rect = this.root.querySelector('.claw-viewport')!.getBoundingClientRect(); if (!rect.width || !rect.height) return
    this.renderer.setSize(rect.width, rect.height); this.camera.aspect = rect.width / rect.height
    this.camera.updateProjectionMatrix()
    const preview = this.root.querySelector('.claw-preview')!.getBoundingClientRect(); if (this.previewRenderer && preview.width && preview.height) { this.previewRenderer.setSize(preview.width, preview.height); this.previewCamera.aspect = preview.width / preview.height; this.previewCamera.updateProjectionMatrix() }
  }
  private setView() {
    this.orbit?.target.set(0, this.view === 'collection' ? 1 : 2.5, this.view === 'collection' ? 2.8 : 0)
    if (this.view === 'front') this.camera.position.set(0, 4.7, 11.4)
    else if (this.view === 'top') this.camera.position.set(.1, 11.5, 5.3)
    else if (this.view === 'collection') this.camera.position.set(4, 3.5, 10)
    else this.camera.position.set(7.2, 6.5, 10)
    this.camera.lookAt(this.orbit?.target ?? new THREE.Vector3(0, 2.5, 0)); this.orbit?.update()
  }
  private buildThumbnails() {
    const renderer = this.previewRenderer!
    renderer.setSize(160, 160)
    for (let i = 0; i < 5; i++) {
      const doll = makeDoll(preset(i), this.bump!); this.previewScene.add(doll)
      this.previewCamera.aspect = 1; this.previewCamera.updateProjectionMatrix()
      renderer.render(this.previewScene, this.previewCamera)
      const image = renderer.domElement.toDataURL()
      const ears = document.createElement('canvas'); ears.width = 160; ears.height = 120
      const ratio = renderer.domElement.width / 160
      ears.getContext('2d')!.drawImage(renderer.domElement, 20 * ratio, 4 * ratio, 120 * ratio, 65 * ratio, 0, 0, 160, 120)
      const earImage = ears.toDataURL()
      for (const element of this.root.querySelectorAll<HTMLImageElement>(`img[data-index="${i}"]`)) element.src = element.dataset.feature === 'base' ? image : element.dataset.feature === 'ears' ? earImage : featureThumbnail(element.dataset.feature!, i)
      this.previewScene.remove(doll); disposeDoll(doll)
    }
  }
  private addToy(options: DollOptions, x?: number, z?: number) {
    const mesh = makeDoll(options, this.bump!); const positions = [[-.95, -.85], [0, -.9], [.95, -.85], [-.85, .05], [.1, 0], [1, .1], [0, .85], [.95, .85]]
    const available = positions.filter(([px, pz]) => this.toys.every(t => Math.hypot(t.mesh.position.x - px!, t.mesh.position.z - pz!) > .45))
    const pos = available[Math.floor(Math.random() * available.length)] ?? [Math.random() * 1.7 - .4, Math.random() * 1.5 - .8]
    mesh.position.set(x ?? pos[0]!, 2 + Math.random() * .7, z ?? pos[1]!); mesh.rotation.y = (Math.random() - .5) * .45; this.scene.add(mesh)
    const body = createToyBody(mesh, this.world)
    this.toys.push({ mesh, body, home: mesh.position.clone(), vy: 0, falling: false, prize: false })
  }
  private refill() { for (const toy of this.toys) { this.scene.remove(toy.mesh); disposeDoll(toy.mesh); if (toy.body) this.world.removeBody(toy.body) }; this.toys = []; for (let i = 0; i < 10; i++) this.addToy(preset(i % 5)); for (let i = 0; i < 240; i++) this.world.step(1 / 60); for (const toy of this.toys) { syncToy(toy.mesh, toy.body!); toy.home.copy(toy.mesh.position) }; this.say('친구들이 준비됐어요. 방향키로 집게를 움직여 주세요.') }
  private ensureShelf(row: number) {
    if (this.shelfRows.has(row)) return
    this.shelfRows.add(row)
    const material = new THREE.MeshStandardMaterial({ color: '#24205b', metalness: .45, roughness: .32 })
    this.box([4.25, .12, 1.05], [0, .18 + row * 1.15, 2.85], material)
    const trim = new THREE.MeshStandardMaterial({ color: '#ff3d9c', emissive: '#ff167f', emissiveIntensity: 1.3 })
    this.box([4.25, .025, .025], [0, .21 + row * 1.15, 3.38], trim)
  }
  private displayPrize(toy: Toy) {
    const slot = this.collection.length, row = Math.floor(slot / 5)
    this.ensureShelf(row)
    toy.mesh.rotation.set(0, 0, 0); toy.mesh.scale.setScalar(.68)
    toy.mesh.position.set((slot % 5 - 2) * .8, .32 + row * 1.15, 2.85)
    this.collection.push(toy.mesh)
    this.toys.splice(this.toys.indexOf(toy), 1)
    this.say(`내 인형 ${this.collection.length}개가 기계 밖 진열대에 모였어요!`)
  }
  private updatePreview() { if (!this.bump) return; if (this.previewDoll) { this.previewScene.remove(this.previewDoll); disposeDoll(this.previewDoll) }; this.previewDoll = makeDoll(this.options, this.bump); this.previewScene.add(this.previewDoll) }
  private async upload(file?: File) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { this.say('10MB 이하의 PNG, JPG, WebP 사진을 골라 주세요.'); return }
    const version = ++this.photoVersion; const url = URL.createObjectURL(file)
    try { const img = new Image(); img.src = url; await img.decode(); if (version !== this.photoVersion) return; this.options.photo = img; this.root.querySelector<HTMLElement>('.claw-remove-photo')!.hidden = false; this.updatePreview(); this.say('사진 패치가 적용됐어요. 기계에 넣기를 눌러 주세요.') } catch { this.say('사진을 읽지 못했어요. 다른 파일을 골라 주세요.') } finally { URL.revokeObjectURL(url) }
  }
  private change(state: State) {
    this.state = state; this.elapsed = 0; this.keys.clear()
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-dir], .claw-drop, .claw-refill, .claw-add')) button.disabled = state !== 'ready'
  }
  private drop() {
    if (this.state !== 'ready' || !this.renderer) return
    this.held = undefined; this.unstable = false; this.targetY = 2.45
    const nearest = this.toys.filter(t => !t.falling && !t.prize).sort((a, b) => this.distance(a) - this.distance(b))[0]
    if (nearest && this.distance(nearest) < .53) { this.held = nearest; this.targetY = nearest.body ? Math.min(3.6, new THREE.Box3().setFromObject(nearest.mesh).max.y + .3) : nearest.mesh.position.y + .98; this.unstable = Math.random() > .82 - this.distance(nearest) * .65 }
    this.change('down'); this.say('집게가 내려갑니다. 이제 잠깐 기다려 주세요!')
  }
  private distance(toy: Toy) { return Math.hypot((toy.body?.position.x ?? toy.mesh.position.x) - this.claw.position.x, (toy.body?.position.z ?? toy.mesh.position.z) - this.claw.position.z) }
  private tick = (time: number) => {
    if (!this.active || !this.renderer) return
    const dt = this.last ? Math.min(.04, (time - this.last) / 1000) : 0; this.last = time; this.elapsed += dt
    if (this.state === 'ready') {
      const dx = Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft')), dz = Number(this.keys.has('ArrowDown')) - Number(this.keys.has('ArrowUp'))
      this.claw.position.x = THREE.MathUtils.clamp(this.claw.position.x + dx * dt * 1.3, -1.35, 1.35); this.claw.position.z = THREE.MathUtils.clamp(this.claw.position.z + dz * dt * 1.3, -1.05, 1.05)
    } else if (this.state === 'down') { this.claw.position.y = Math.max(this.targetY, this.claw.position.y - dt * 1.1); if (this.claw.position.y === this.targetY) this.change('close') }
    else if (this.state === 'close') { if (this.elapsed > .75) { this.change('up'); this.say(this.held ? '잡았어요! 살살 올라가는 중…' : '아쉽게도 빗나갔어요. 다시 도전해 보세요.') } }
    else if (this.state === 'up') {
      this.claw.position.y = Math.min(4.3, this.claw.position.y + dt * .9)
      if (this.held && this.unstable && this.claw.position.y > 3.4) { this.held.falling = true; this.held.vy = 0; if (this.held.body) releaseToy(this.held.body); this.held = undefined; this.say('앗, 인형이 미끄러졌어요!') }
      if (this.claw.position.y === 4.3) this.change('travel')
    } else if (this.state === 'travel') { const target = new THREE.Vector3(-1.25, 4.3, 1.05); this.moveTo(target, dt); if (this.claw.position.distanceTo(target) < .015) this.change('release') }
    else if (this.state === 'release') {
      if (this.held && this.elapsed > .5) { this.held.prize = true; if (this.held.body) this.world.removeBody(this.held.body); this.held.falling = true; this.held.vy = 0; this.held = undefined; this.root.querySelector('.claw-wins strong')!.textContent = String(++this.wins); this.say('성공! 출구에서 친구를 받아 주세요 ✨') }
      if (this.elapsed > 2.7) this.change('return')
    } else if (this.state === 'return') { const target = new THREE.Vector3(0, 4.3, 0); this.moveTo(target, dt); if (this.claw.position.distanceTo(target) < .015) this.change('ready') }
    const closed = ['up', 'travel'].includes(this.state) ? 1 : this.state === 'close' ? Math.min(1, this.elapsed / .75) : this.state === 'release' ? Math.max(0, 1 - this.elapsed / .5) : 0
    this.fingers.forEach(f => { f.rotation.z = -closed * .38 })
    if (this.held && ['up', 'travel', 'release'].includes(this.state)) {
      if (this.held.body) {
        const body = this.held.body; body.type = CANNON.Body.KINEMATIC; body.velocity.setZero(); body.angularVelocity.setZero(); body.position.set(this.claw.position.x, this.claw.position.y - .6, this.claw.position.z); syncToy(this.held.mesh, body)
      } else { this.held.mesh.position.copy(this.claw.position).add(new THREE.Vector3(0, -.98, 0)); this.held.mesh.rotation.z = Math.sin(time / 250) * .09 }
    }
    this.world.step(1 / 60, dt, 3)
    for (const toy of this.toys) if (toy.body && !toy.prize) { syncToy(toy.mesh, toy.body); toy.falling = false }
    for (const toy of [...this.toys]) {
      if (!toy.falling) continue
      toy.vy -= dt * 6; toy.mesh.position.y += toy.vy * dt
      if (toy.prize) {
        if (toy.mesh.position.y < .65) { toy.mesh.position.y = .5; toy.mesh.position.z += dt * 1.5; toy.mesh.rotation.x -= dt * 2; if (toy.mesh.position.z > 2.8) { this.displayPrize(toy) } }
      } else if (toy.mesh.position.y <= toy.home.y) { toy.mesh.position.y = toy.home.y; toy.falling = false; toy.mesh.rotation.z = .1 }
    }
    this.carriage!.position.x = this.claw.position.x
    this.cable!.position.set(this.claw.position.x, (4.6 + this.claw.position.y) / 2, this.claw.position.z); this.cable!.scale.y = 4.6 - this.claw.position.y
    if (this.previewDoll) this.previewDoll.rotation.y = Math.sin(time / 1700) * .3
    this.orbit?.update()
    this.renderer.render(this.scene, this.camera); this.previewRenderer?.render(this.previewScene, this.previewCamera)
    this.frame = requestAnimationFrame(this.tick)
  }
  private moveTo(target: THREE.Vector3, dt: number) { const delta = target.clone().sub(this.claw.position); this.claw.position.add(delta.multiplyScalar(Math.min(1, dt * 1.3 / Math.max(.001, delta.length())))) }
}
