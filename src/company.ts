import * as THREE from 'three'
import { followCompanyCamera } from './company-camera.ts'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { buildOffice, companyStations, makeAvatar, ellipsoid, mat, textSprite, facePrint, type CompanyPlayer, type CompanyBoss, type StationKey } from './company-art.ts'
type Avatar = ReturnType<typeof makeAvatar> & { data: CompanyPlayer; weather: THREE.Group; cloud: THREE.Group; sun: THREE.Group; rain: THREE.Points; bolt: THREE.Line; tasks: THREE.Sprite[]; cheers: THREE.Sprite[]; joy: THREE.Group; lastPrint: number; lastAction: number }
export class CompanyScene {
  private root: HTMLElement
  private renderer?: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(43, 1, .1, 100)
  private orbit?: OrbitControls
  private viewInitialized = false
  private cameraDragging = false
  private cameraManualUntil = 0
  private focusPlayer = true
  private active = false
  private frame = 0
  private last = 0
  private socket?: WebSocket
  private id = ''
  private players = new Map<string, Avatar>()
  private boss?: ReturnType<typeof makeAvatar>
  private bossSpeech: THREE.Sprite[] = []
  private bossState: CompanyBoss = { anger: 0, mood: 'angry', changedAt: 0, cycles: 0 }
  private bossResignation = 0
  private bossPressure = 0
  private bossMaxAt = 0
  private bossWasMax = false
  private keys = new Set<string>()
  private stick = { x: 0, z: 0 }
  private lastSent = 0
  private offset = 0
  private papers: { mesh: THREE.Mesh; age: number; origin: THREE.Vector3 }[] = []
  private audio?: AudioContext
  private muted = false
  private lastHum = 0
  private joinTimer = 0
  constructor(root: HTMLElement) {
    this.root = root
    root.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); const input = root.querySelector<HTMLInputElement>('[name="nickname"]')!; this.unlockAudio(); this.join(input.value) })
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-use]')) button.addEventListener('click', () => this.send({ type: 'use', station: button.dataset.use }))
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-action]')) button.addEventListener('click', () => this.action())
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-leave]')) button.addEventListener('click', () => this.send({ type: 'leave' }))
    root.querySelector('.company-follow')!.addEventListener('click', () => { this.cameraManualUntil = 0; this.focusPlayer = true })
    root.querySelector('.company-mute')!.addEventListener('click', () => { this.muted = !this.muted; root.querySelector('.company-mute')!.textContent = this.muted ? '소리 꺼짐' : '소리 켜짐 ♪'; root.querySelector('.company-mute')!.setAttribute('aria-pressed', String(this.muted)); this.unlockAudio() })
    window.addEventListener('keydown', event => {
      if (!this.active || !this.id || (event.target instanceof HTMLElement && event.target.closest('input'))) return
      if (event.key.startsWith('Arrow')) { event.preventDefault(); this.keys.add(event.key) }
      if (event.code === 'Space') { event.preventDefault(); if (!event.repeat) this.action() }
    })
    window.addEventListener('keyup', event => this.keys.delete(event.key))
    window.addEventListener('blur', () => this.stopMove())
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stopMove() })
    const joystick = root.querySelector<HTMLElement>('.company-joystick')!
    const move = (event: PointerEvent) => { const rect = joystick.getBoundingClientRect(); let x = (event.clientX - rect.left - rect.width / 2) / 33, z = (event.clientY - rect.top - rect.height / 2) / 33; const length = Math.max(1, Math.hypot(x, z)); x /= length; z /= length; this.stick = { x, z }; joystick.querySelector<HTMLElement>('span')!.style.transform = `translate(${x * 25}px, ${z * 25}px)` }
    joystick.addEventListener('pointerdown', event => { joystick.setPointerCapture(event.pointerId); move(event) })
    joystick.addEventListener('pointermove', event => { if (joystick.hasPointerCapture(event.pointerId)) move(event) })
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(type, () => { this.stick = { x: 0, z: 0 }; joystick.querySelector<HTMLElement>('span')!.style.transform = ''; this.send({ type: 'move', x: 0, z: 0 }) })
    new ResizeObserver(() => this.resize()).observe(root.querySelector('.company-viewport')!)
  }
  setActive(active: boolean) {
    if (this.active === active) return
    this.active = active; cancelAnimationFrame(this.frame)
    if (!active) { this.stopMove(); clearTimeout(this.joinTimer); this.socket?.close(); this.socket = undefined; this.id = ''; for (const avatar of this.players.values()) this.disposeAvatar(avatar); this.players.clear(); for (const paper of this.papers) this.removePaper(paper); this.papers = []; this.audio?.suspend(); this.root.querySelector<HTMLElement>('.company-entry')!.hidden = false; return }
    if (!this.renderer) { try { this.initialize() } catch { this.entryStatus('3D 화면을 열 수 없어요. WebGL을 지원하는 브라우저에서 시도해 주세요.'); return } }
    this.resize(); this.last = 0; this.frame = requestAnimationFrame(this.tick)
  }
  private initialize() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap; this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.root.querySelector('.company-viewport')!.append(this.renderer.domElement)
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement); this.orbit.enableRotate = false; this.orbit.enableDamping = true; this.orbit.enablePan = true; this.orbit.screenSpacePanning = false; this.orbit.zoomToCursor = true; this.orbit.minDistance = 6; this.orbit.maxDistance = 42; this.orbit.mouseButtons.LEFT = THREE.MOUSE.PAN; this.orbit.touches.ONE = THREE.TOUCH.PAN
    this.orbit.addEventListener('start', () => { this.cameraDragging = true })
    this.orbit.addEventListener('end', () => { this.cameraDragging = false; this.cameraManualUntil = performance.now() + 2000 })
    this.scene.add(new THREE.HemisphereLight('#fff7ea', '#aaa1b4', 2))
    const light = new THREE.DirectionalLight('#fff7ed', 2.7); light.position.set(-6, 16, 8); light.castShadow = true; light.shadow.mapSize.set(2048, 2048); Object.assign(light.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 }); light.shadow.normalBias = .04; this.scene.add(light)
    buildOffice(this.scene)
    const bossData: CompanyPlayer = { id: 'boss', nickname: '부장님', x: -5, z: -4.3, angle: 0, shirt: 0, skin: 1, hair: 0, outfit: 0, station: null, slot: 0, tasks: 0, pose: 0, anger: 0, actionAt: 0, result: '' }
    this.boss = makeAvatar(bossData, true); this.boss.group.position.set(-5, .38, -4.3); this.scene.add(this.boss.group)
    this.bossSpeech = ['어디까지 했죠?', '이게 최종이라고요?!', '아까도 말했잖아요!', '다시! 다시 확인해요!', '회의 한 번 더 합시다!', '내가 말을 말아야지!!', '하… 말해 봐야 뭐 하겠어.', '그래… 마음대로 해요…', '나만 진심이었지…'].map(text => {
      const sad = text.includes('…')
      const bubble = textSprite(text, sad ? '#77718c' : '#a7353b', sad ? '#eef0f7' : '#fff1de', 3.1)
      bubble.position.set(0, 2.6, 0); bubble.visible = false; this.boss!.group.add(bubble); return bubble
    })
  }
  private resize() {
    if (!this.renderer || !this.active) return
    const rect = this.root.querySelector('.company-viewport')!.getBoundingClientRect(); if (!rect.width || !rect.height) return
    this.renderer.setSize(rect.width, rect.height); this.camera.aspect = rect.width / rect.height
    if (!this.viewInitialized) { const distance = this.camera.aspect < 1 ? 1.15 : 1; this.camera.position.set(0, 8.5 * distance, 10.5 * distance); this.orbit?.target.set(0, .9, 0); this.camera.lookAt(0, .9, 0); this.viewInitialized = true; this.orbit?.update() }
    this.camera.updateProjectionMatrix()
  }
  private entryStatus(text: string) { this.root.querySelector('.company-entry-status')!.textContent = text }
  private join(nickname: string) {
    if (!nickname.trim() || !this.renderer) return
    this.socket?.close(); this.id = ''; clearTimeout(this.joinTimer)
    this.entryStatus('동료들과 연결하는 중…')
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/company`); this.socket = socket
    this.joinTimer = window.setTimeout(() => { if (this.socket === socket && !this.id) { socket.close(); this.entryStatus('회사에 연결할 수 없어요. 모임을 연 사람에게 접속 주소를 확인해 주세요.') } }, 8000)
    socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'join', nickname })))
    socket.addEventListener('message', event => {
      if (this.socket !== socket || !this.active) return
      let message; try { message = JSON.parse(event.data) } catch { return }
      if (message.type === 'welcome') { clearTimeout(this.joinTimer); this.id = message.id; this.focusPlayer = true; this.cameraManualUntil = 0; this.root.querySelector<HTMLElement>('.company-entry')!.hidden = true; this.entryStatus(''); this.root.querySelector<HTMLElement>('.company-viewport')!.focus({ preventScroll: true }) }
      else if (message.type === 'state') { this.offset = message.now - Date.now(); if (message.boss) this.bossState = message.boss; this.updatePlayers(message.players) }
      else if (message.type === 'error') this.entryStatus(message.message)
    })
    socket.addEventListener('close', () => { if (this.socket !== socket) return; clearTimeout(this.joinTimer); this.id = ''; this.root.querySelector<HTMLElement>('.company-entry')!.hidden = false; this.entryStatus('연결이 끊어졌어요. 접속 주소를 확인한 뒤 다시 출근해 주세요.'); this.stopMove(); for (const avatar of this.players.values()) this.disposeAvatar(avatar); this.players.clear(); this.root.querySelector('.company-presence strong')!.textContent = '0' })
    socket.addEventListener('error', () => { if (this.socket === socket) this.entryStatus('회사에 연결할 수 없어요. 모임을 연 사람에게 주소를 확인해 주세요.') })
  }
  private send(message: object) { if (this.socket?.readyState === WebSocket.OPEN && this.id) this.socket.send(JSON.stringify(message)) }
  private stopMove() { this.keys.clear(); this.stick = { x: 0, z: 0 }; this.send({ type: 'move', x: 0, z: 0 }) }
  private action() { this.unlockAudio(); this.send({ type: 'action' }) }
  private unlockAudio() { try { this.audio ??= new AudioContext(); void this.audio.resume() } catch { /* Animation still works without audio. */ } }
  private tone(frequency: number, seconds: number, delay = 0) {
    if (this.muted || !this.audio || this.audio.state !== 'running') return
    const osc = this.audio.createOscillator(), gain = this.audio.createGain(), now = this.audio.currentTime + delay
    osc.type = 'sine'; osc.frequency.setValueAtTime(frequency, now); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.045, now + .025); gain.gain.exponentialRampToValueAtTime(.001, now + seconds); osc.connect(gain); gain.connect(this.audio.destination); osc.start(now); osc.stop(now + seconds + .02); osc.onended = () => { osc.disconnect(); gain.disconnect() }
  }
  private newAvatar(p: CompanyPlayer): Avatar {
    const avatar = makeAvatar(p); avatar.group.position.set(p.x, 0, p.z); this.scene.add(avatar.group)
    const weather = new THREE.Group(), cloud = new THREE.Group(), sun = new THREE.Group(); weather.position.y = 2.05; avatar.group.add(weather); weather.add(cloud, sun)
    for (let i = 0; i < 4; i++) ellipsoid(cloud, mat('#6e7b91'), (i - 1.5) * .2, 0, 0, .25, .14 + i % 2 * .08, .2)
    ellipsoid(sun, new THREE.MeshBasicMaterial({ color: '#ffd357' }), 0, .12, 0, .22, .22, .22)
    for (let i = 0; i < 8; i++) { const ray = new THREE.Mesh(new THREE.BoxGeometry(.05, .14, .05), new THREE.MeshBasicMaterial({ color: '#ffd357' })); ray.position.set(Math.sin(i * Math.PI / 4) * .34, .12 + Math.cos(i * Math.PI / 4) * .34, 0); ray.rotation.z = -i * Math.PI / 4; sun.add(ray) }
    const vertices = new Float32Array(36 * 3); for (let i = 0; i < 36; i++) { vertices[i * 3] = (Math.random() - .5) * .8; vertices[i * 3 + 1] = -Math.random() * 1.7; vertices[i * 3 + 2] = (Math.random() - .5) * .7 }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); const rain = new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#548fcb', size: .045 })); weather.add(rain)
    const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.1, 0, .1), new THREE.Vector3(-.1, -.3, .1), new THREE.Vector3(.08, -.3, .1), new THREE.Vector3(-.12, -.65, .1)]), new THREE.LineBasicMaterial({ color: '#fff05b' })); weather.add(bolt)
    const tasks = ['시안 수정하기', '클라이언트 피드백', '회의 자료 만들기', '최종_진짜최종 전달'].map((text, i) => { const sprite = textSprite(text, '#625576', '#fffaf2', 2); sprite.position.set(0, 3.4 + i * .85, 0); avatar.group.add(sprite); return sprite })
    const cheers = ['흥~ 흥~ ♪ 내 마음은 휴가', '아하하하! 너무 행복해!', '여기가 나의 휴양지 ♡'].map(text => {
      const bubble = textSprite(text, '#9155ae', '#fff2fd', 2.5); bubble.position.y = 2.6; bubble.visible = false; avatar.group.add(bubble); return bubble
    })
    const joy = new THREE.Group(); joy.position.y = 1.8; avatar.group.add(joy)
    for (let i = 0; i < 6; i++) {
      const sparkle = new THREE.Mesh(new THREE.OctahedronGeometry(.075), new THREE.MeshBasicMaterial({ color: i % 2 ? '#f599c5' : '#ffd657' }))
      sparkle.position.set(Math.cos(i * Math.PI / 3) * .75, Math.sin(i * Math.PI / 3) * .35, .1); joy.add(sparkle)
    }
    return { ...avatar, data: p, weather, cloud, sun, rain, bolt, tasks, cheers, joy, lastPrint: 0, lastAction: 0 }
  }
  private updatePlayers(players: CompanyPlayer[]) {
    const ids = new Set(players.map(p => p.id))
    for (const [id, avatar] of this.players) if (!ids.has(id)) { this.disposeAvatar(avatar); this.players.delete(id) }
    for (const p of players) { const avatar = this.players.get(p.id) ?? this.newAvatar(p); avatar.data = p; this.players.set(p.id, avatar) }
    this.root.querySelector('.company-presence strong')!.textContent = String(players.length)
  }
  private disposeAvatar(avatar: Avatar) {
    this.scene.remove(avatar.group)
    // Sphere geometry is shared by the models; release owned text and effects.
    avatar.group.traverse(object => { if (object instanceof THREE.Sprite) { object.material.map?.dispose(); object.material.dispose() } else if (object instanceof THREE.Mesh) { if (!(object.geometry instanceof THREE.SphereGeometry)) object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose() } })
    avatar.rain.geometry.dispose(); (avatar.rain.material as THREE.Material).dispose(); avatar.bolt.geometry.dispose(); (avatar.bolt.material as THREE.Material).dispose()
  }
  private print(avatar: Avatar) {
    const texture = facePrint(avatar.data), material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: .9 })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.55, .6), material)
    const origin = new THREE.Vector3(avatar.data.x, .75, companyStations.printer.z + .7); mesh.position.copy(origin); this.scene.add(mesh); this.papers.push({ mesh, origin, age: 0 })
    if (this.papers.length > 60) this.removePaper(this.papers.shift()!)
  }
  private removePaper(paper: { mesh: THREE.Mesh }) { this.scene.remove(paper.mesh); paper.mesh.geometry.dispose(); const material = paper.mesh.material as THREE.MeshStandardMaterial; material.map?.dispose(); material.dispose() }
  private tick = (time: number) => {
    if (!this.active || !this.renderer) return
    const dt = this.last ? Math.min(.05, (time - this.last) / 1000) : 0; this.last = time
    const now = Date.now() + this.offset
    if (time - this.lastSent > 50 && this.id) { this.lastSent = time; this.send({ type: 'move', x: this.stick.x + Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft')), z: this.stick.z + Number(this.keys.has('ArrowDown')) - Number(this.keys.has('ArrowUp')) }) }
    const anger = this.bossState.anger
    let bossOccupied = false
    for (const avatar of this.players.values()) {
      const p = avatar.data, moving = Math.hypot(avatar.group.position.x - p.x, avatar.group.position.z - p.z) > .025
      avatar.group.position.x = THREE.MathUtils.damp(avatar.group.position.x, p.x, 14, dt); avatar.group.position.z = THREE.MathUtils.damp(avatar.group.position.z, p.z, 14, dt)
      avatar.group.rotation.set(0, p.angle, 0); avatar.group.position.y = 0; avatar.head.rotation.set(0, 0, 0)
      const wave = Math.sin(time / 100)
      avatar.arms.forEach((arm, i) => { arm.rotation.set(moving ? wave * .7 * (i ? -1 : 1) : 0, 0, i ? -.1 : .1) })
      avatar.legs.forEach((leg, i) => { leg.rotation.x = moving ? wave * .7 * (i ? 1 : -1) : 0 })
      if (p.station) {
        avatar.group.position.y = .38; avatar.legs.forEach(leg => { leg.rotation.x = -Math.PI / 2 })
        if (p.station === 'boss') { bossOccupied = true; avatar.head.rotation.x = .25 + Math.sin(time / 220) * .1; avatar.arms.forEach((arm, i) => { arm.rotation.z = i ? -.35 : .35 });  }
        if (p.station === 'printer') {
          avatar.group.position.y = 0
          avatar.group.rotation.x = [.35, .65, 0, -.25][p.pose]!
          avatar.head.rotation.z = [0, .4, -.4, 0][p.pose]!
          avatar.arms.forEach((arm, i) => { arm.rotation.x = p.pose === 3 ? -2.5 : -1; arm.rotation.z = p.pose === 2 ? (i ? -1 : 1) : 0 })
          if (time - avatar.lastPrint > 800) { this.print(avatar); avatar.lastPrint = time }
        }
        if (p.station === 'toilet') {
          avatar.legs.forEach((leg, i) => { leg.rotation.x = -1.2 + Math.sin(time / 105 + i * Math.PI) * .6 })
          if (now - p.actionAt < 2200) { avatar.group.position.y += Math.abs(Math.sin(time / 65)) * .15; avatar.head.rotation.z = Math.sin(time / 80) * .23; avatar.arms.forEach((arm, i) => { arm.rotation.x = -1.8; arm.rotation.z = Math.sin(time / 80 + i * Math.PI) * .5 }) }
          if (p.id === this.id && time - this.lastHum > 450) { this.lastHum = time; this.tone([262, 330, 392, 330, 294, 349, 440, 392][Math.floor(time / 450) % 8]!, .35) }
        }
        if (p.station === 'desk') avatar.arms.forEach((arm, i) => { arm.rotation.x = -1.1 + Math.sin(time / 75 + i * Math.PI) * .12 })
      }
      // Keep the desk name tag below the avatar, outside the weather area.
      if (p.station === 'desk') {
        avatar.label.position.set(0, -.05, -.65)
        avatar.label.scale.set(1.5, .375, 1)
      } else {
        avatar.label.position.set(0, 1.86, 0)
        avatar.label.scale.set(1.8, .45, 1)
      }
      avatar.weather.visible = p.station === 'desk'; avatar.cloud.visible = p.tasks > 0; avatar.cloud.scale.setScalar(.45 + p.tasks * .14); avatar.rain.visible = p.tasks > 0; avatar.sun.visible = p.tasks < 4; avatar.sun.scale.setScalar(1 - p.tasks / 4); avatar.bolt.visible = p.tasks > 1 && time % 2400 < 100
      const rain = avatar.rain.geometry.attributes.position!
      for (let i = 0; i < rain.count; i++) { let y = rain.getY(i) - dt * 2.8; if (y < -1.7) y = 0; rain.setY(i, y) }; rain.needsUpdate = true
      ;(avatar.rain.material as THREE.PointsMaterial).opacity = p.tasks / 4; (avatar.rain.material as THREE.PointsMaterial).transparent = true
      avatar.tasks.forEach((task, i) => { task.visible = p.station === 'desk' && i < p.tasks; task.position.y = 3.4 + i * .85 + Math.sin(time / 900 + i) * .04 })
      const laughing = p.station === 'toilet' && now - p.actionAt < 2200
      avatar.cheers.forEach((bubble, i) => {
        bubble.visible = p.station === 'toilet' && i === (laughing ? 1 : Math.floor(now / 3000) % 2 ? 2 : 0)
        bubble.position.y = 2.6 + Math.sin(time / 240) * .045
        bubble.scale.set(laughing ? 2.8 : 2.5, laughing ? .7 : .625, 1)
      })
      avatar.joy.visible = laughing; avatar.joy.rotation.z = Math.sin(time / 200) * .15
      avatar.joy.scale.setScalar(1 + Math.sin(time / 100) * .12)
      if (p.actionAt > avatar.lastAction) { avatar.lastAction = p.actionAt; if (p.station === 'printer') this.print(avatar); if (p.id === this.id && p.station === 'toilet') for (let i = 0; i < 5; i++) this.tone(440 + i % 2 * 130, .12, i * .15) }
    }
    if (this.boss) {
      const dejected = this.bossState.mood === 'dejected'
      this.bossResignation = THREE.MathUtils.damp(this.bossResignation, dejected ? 1 : 0, dejected ? 9 : 5, dt)
      const slump = this.bossResignation
      const maximum = anger >= 5 && !dejected
      if (maximum && !this.bossWasMax) this.bossMaxAt = now
      this.bossWasMax = maximum
      this.bossPressure = THREE.MathUtils.damp(this.bossPressure, maximum ? 1 : 0, dejected ? 16 : 7, dt)
      const pressure = this.bossPressure
      const elapsed = Math.max(0, (now - this.bossMaxAt) / 1000)
      const rattle = Math.abs(Math.sin(now / 72))
      const launch = Math.sin(elapsed * 17) * .22 * Math.exp(-elapsed * 3)
      this.boss.hairGroup.position.set(Math.sin(now / 46) * .045 * pressure, (.6 + rattle * .16 + launch) * pressure, 0)
      this.boss.hairGroup.rotation.set(Math.sin(now / 64) * .13 * pressure, 0, Math.sin(now / 51) * .18 * pressure)
      this.boss.hairGroup.scale.set(1, 1 + pressure * .8, 1)
      // Lift the hips off the stationary chair in the same rhythm as the hair.
      this.boss.group.position.y = .38 - .04 * slump + rattle * .22 * pressure
      this.boss.group.rotation.x = .13 * slump + Math.sin(now / 144) * .07 * pressure
      this.boss.legs.forEach((leg, i) => { leg.rotation.x = -Math.PI / 2 - pressure * .2 + Math.sin(now / 72 + i * Math.PI) * .2 * pressure })
      this.boss.steam.visible = pressure > .1
      this.boss.steam.children.forEach((puff, i) => {
        const cycle = (now / 600 + i / 8) % 1
        puff.position.set((i % 2 ? -.38 : .38) * (1 + cycle * .5), cycle * .65, -.05)
        puff.scale.setScalar((.04 + cycle * .07) * pressure)
      })
      this.boss.head.rotation.z = Math.sin(now / Math.max(80, 350 - anger * 50)) * (.02 + anger * .035) * (1 - slump)
      this.boss.head.rotation.x = .4 * slump
      this.boss.head.position.y = 1.12 - .1 * slump
      this.boss.torso.position.y = .56 - .04 * slump
      this.boss.torso.scale.y = .32 - .035 * slump
      this.boss.brows.forEach((brow, i) => { const side = i ? 1 : -1; brow.rotation.z = side * (.45 - .8 * slump) })
      this.boss.mouth.position.y = -.16 - .04 * slump
      this.boss.arms.forEach((arm, i) => { arm.rotation.x = (-.4 - anger * .15 + Math.sin(now / 110 + i) * anger * .09) * (1 - slump); arm.rotation.z = (i ? -.08 : .08) * slump })
      this.boss.head.scale.setScalar(1 + anger * .025)
      this.boss.faceMaterial.color.lerp(new THREE.Color('#e3ad81').lerp(new THREE.Color('#ef3038'), anger / 5), Math.min(1, dt * (dejected ? 9 : 4)))
      // Keep the name tag out of the airborne hair's path.
      this.boss.label.position.set(0, maximum ? .1 : 1.86, maximum ? .65 : 0)
    }
    this.bossSpeech.forEach((bubble, i) => {
      const line = this.bossState.mood === 'dejected' ? 6 + Math.floor(now / 2600) % 3 : anger === 0 ? 0 : Math.min(5, 1 + (Math.floor(now / 2400) % Math.min(5, anger + 1)))
      bubble.visible = bossOccupied && i === line
      bubble.position.y = 2.6 + Math.sin(time / 170) * anger * .008
    })
    for (const paper of [...this.papers]) { paper.age += dt; paper.mesh.position.z = paper.origin.z + Math.min(1.2, paper.age * .7); paper.mesh.position.y = Math.max(.05, .8 + .3 * paper.age - .6 * paper.age ** 2); paper.mesh.rotation.x = -Math.PI / 2 * Math.min(1, paper.age); paper.mesh.rotation.z = Math.sin(paper.age * 2) * .2; if (paper.age > 7) { this.removePaper(paper); this.papers.splice(this.papers.indexOf(paper), 1) } }
    this.orbit?.update()
    const mine = this.players.get(this.id)
    const movingMyself = this.keys.size > 0 || Math.hypot(this.stick.x, this.stick.z) > .05
    if (mine && this.orbit && !this.cameraDragging && (this.focusPlayer || movingMyself || time > this.cameraManualUntil)) {
      followCompanyCamera(this.camera, this.orbit.target, mine.group.position, dt, this.focusPlayer)
      this.focusPlayer = false
      this.camera.lookAt(this.orbit.target)
    }
    this.camera.updateMatrixWorld()
    this.updateUI(now)
    this.renderer.render(this.scene, this.camera); this.frame = requestAnimationFrame(this.tick)
  }
  private updateUI(now: number) {
    const p = this.players.get(this.id)?.data
    const viewport = this.root.querySelector<HTMLElement>('.company-viewport')!
    const width = viewport.clientWidth, height = viewport.clientHeight
    const actions: Record<StationKey, string> = { boss: '화나게 하기', printer: '내 얼굴 출력', toilet: '깔깔 웃기', desk: '업무 하나 끝내기' }
    for (const [key, station] of Object.entries(companyStations) as [StationKey, typeof companyStations.boss][]) {
      const card = this.root.querySelector<HTMLElement>(`[data-station="${key}"]`)!
      const ownSeat = p?.station === key
      const anchor = new THREE.Vector3(ownSeat ? p.x : station.x, .8, station.z + 2.5).project(this.camera)
      card.hidden = anchor.z < -1 || anchor.z > 1 || Math.abs(anchor.x) > 1.2 || Math.abs(anchor.y) > 1.2
      card.style.left = `${(anchor.x + 1) * width / 2}px`; card.style.top = `${(1 - anchor.y) * height / 2}px`
      const use = card.querySelector<HTMLButtonElement>('[data-use]')!, action = card.querySelector<HTMLButtonElement>('[data-action]')!, leave = card.querySelector<HTMLButtonElement>('[data-leave]')!
      const nearby = !!p && Math.hypot(p.x - station.x, p.z - station.z) < 3
      use.hidden = !!ownSeat; use.disabled = !p || !!p.station || !nearby
      use.textContent = nearby ? '갓생살기' : '가까이 와 주세요'
      action.hidden = !ownSeat; leave.hidden = !ownSeat
      action.textContent = `${actions[key]} · SPACE`
      card.classList.toggle('is-laughing', key === 'toilet' && !!ownSeat && now - p.actionAt < 2200)
    }
    const rhythm = this.root.querySelector<HTMLElement>('.company-rhythm')!; rhythm.hidden = p?.station !== 'boss'; rhythm.querySelector<HTMLElement>('i')!.style.left = `${(Math.sin(now / 550) + 1) * 50}%`
    const hints = { boss: '초록 구간에서 SPACE! 타이밍을 맞추면 부장님이 더 화나요.', printer: '자동으로 계속 출력 중 · SPACE로 얼굴 자세를 바꿔 보세요.', toilet: '다리를 흔들며 콧노래 ♪ SPACE로 깔깔 웃기', desk: 'SPACE를 누를 때마다 업무 하나씩 완료! 내 날씨를 맑게 만들어 봐요.' }
    const feedback = this.root.querySelector<HTMLElement>('.company-boss-feedback')!
    feedback.hidden = p?.station !== 'boss'
    feedback.textContent = p?.station === 'boss' ? now - p.actionAt < 1800 ? p.result : this.bossState.mood === 'dejected' ? '시무룩… 계속 자극하면 다시 분노가 쌓여요.' : `${hints.boss} (분노 ${this.bossState.anger}/5)` : ''
    feedback.classList.toggle('is-success', p?.station === 'boss' && now - p.actionAt < 1800 && p.result.includes('정확'))
    const status = this.root.querySelector<HTMLElement>('.company-status')!
    status.hidden = p?.station === 'boss'
    status.textContent = !p ? '닉네임을 입력하고 출근해 주세요.' : p.station ? now - p.actionAt < 1800 ? p.result : hints[p.station] : '동료들과 함께 걸어 보세요. 가까운 자리에서 갓생살기!'
  }
}
