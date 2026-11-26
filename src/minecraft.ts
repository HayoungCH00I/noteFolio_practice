import * as THREE from 'three'
import { FruitTracker } from './fruit-tracker.ts'
import { cameraFailure, trackingFailure } from './choir-camera-errors.ts'
import { createSword } from './minecraft-sword.ts'
import { hitsCenter, swingDuration, swingMotion, type PersonMask } from './minecraft-core.ts'

export class MinecraftScene {
  private root: HTMLElement
  private video: HTMLVideoElement
  private hurt: HTMLCanvasElement
  private maskCanvas = document.createElement('canvas')
  private renderer: THREE.WebGLRenderer
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 20)
  private scene = new THREE.Scene()
  private grip = new THREE.Group()
  private tracker?: FruitTracker
  private stream?: MediaStream
  private mask?: PersonMask
  private maskAt = 0
  private active = false
  private loading = false
  private token = 0
  private busy = false
  private frame = 0
  private lastSample = 0
  private videoTime = -1
  private swingAt = -Infinity
  private hurtAt = -Infinity
  private swordReady?: Promise<void>
  constructor(root: HTMLElement) {
    this.root = root; this.video = root.querySelector('video')!; this.hurt = root.querySelector('.minecraft-hurt')!
    this.renderer = new THREE.WebGLRenderer({ canvas: root.querySelector<HTMLCanvasElement>('.minecraft-weapon')!, alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); this.camera.position.z = 8
    this.scene.add(this.grip)
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(.44, .78, .42), new THREE.MeshBasicMaterial({ color: 0x328aa2 }))
    sleeve.position.set(.25, -.55, .06); sleeve.rotation.z = -.32
    const hand = new THREE.Mesh(new THREE.BoxGeometry(.35, .35, .37), new THREE.MeshBasicMaterial({ color: 0xc78f6d }))
    hand.position.set(.1, -.12, .1); this.grip.add(sleeve, hand)
    root.querySelector('.minecraft-start')!.addEventListener('click', () => { void this.start() })
    root.querySelector('.minecraft-stop')!.addEventListener('click', () => this.stop())
    root.querySelector('.minecraft-attack')!.addEventListener('click', () => this.attack())
    root.addEventListener('pointerdown', event => { if (!(event.target as Element).closest('button, .minecraft-entry')) this.attack() })
    new ResizeObserver(() => this.resize()).observe(root)
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.stream) this.stop() })
  }
  setActive(active: boolean) { if (this.active === active) return; this.active = active; if (!active) this.stop(); else this.resize() }
  private resize() {
    const rect = this.root.getBoundingClientRect(); if (!rect.width || !rect.height) return
    const aspect = rect.width / rect.height; this.camera.left = -aspect; this.camera.right = aspect; this.camera.updateProjectionMatrix()
    this.renderer.setSize(rect.width, rect.height, false); this.grip.position.set(aspect * .72, -.82, 0)
    this.renderer.render(this.scene, this.camera)
  }
  private error(text: string) { this.root.querySelector('.minecraft-error')!.textContent = text }
  private async start() {
    if (!this.active || this.loading || this.stream) return
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { this.error('카메라를 사용하려면 localhost 또는 HTTPS로 접속해 주세요.'); return }
    const token = ++this.token; this.loading = true; const button = this.root.querySelector<HTMLButtonElement>('.minecraft-start')!; button.disabled = true; this.error('카메라 사용을 허용해 주세요.')
    let phase: 'camera' | 'tracking' = 'camera'
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }, audio: false })
      if (!this.active || token !== this.token) { stream.getTracks().forEach(track => track.stop()); return }
      this.stream = stream; this.video.srcObject = stream; await this.video.play()
      if (token !== this.token) return
      phase = 'tracking'; this.error('사람 인식을 준비하고 있어요…')
      const tracker = new FruitTracker('snow'); this.tracker = tracker
      this.swordReady ??= createSword().then(sword => { sword.rotation.z = Math.PI * .42; sword.scale.setScalar(1.42); this.grip.add(sword) }).catch(error => { this.swordReady = undefined; throw error })
      await Promise.all([tracker.init(new URL(`${import.meta.env.BASE_URL}mediapipe`, location.href).href), this.swordReady])
      if (token !== this.token) { tracker.close(); return }
      this.root.querySelector<HTMLElement>('.minecraft-entry')!.hidden = true; this.root.querySelector<HTMLElement>('.minecraft-stop')!.hidden = false; this.root.querySelector<HTMLElement>('.minecraft-attack')!.hidden = false
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (token === this.token) { this.stop(); this.error('카메라 연결이 끝났어요. 다시 켜 주세요.') } }, { once: true })
      this.lastSample = 0; this.videoTime = -1; this.resize(); this.frame = requestAnimationFrame(this.tick)
    } catch (error) {
      if (token !== this.token) return
      this.stop(); this.error(phase === 'camera' ? cameraFailure(error) : trackingFailure(error))
    } finally { if (token === this.token) { this.loading = false; button.disabled = false } }
  }
  private stop() {
    this.token++; cancelAnimationFrame(this.frame); this.frame = 0; this.tracker?.close(); this.tracker = undefined; this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined
    this.video.pause(); this.video.srcObject = null; this.loading = false; this.busy = false; this.mask = undefined; this.maskAt = 0; this.swingAt = this.hurtAt = -Infinity
    this.hurt.getContext('2d')!.clearRect(0, 0, this.hurt.width, this.hurt.height)
    this.root.querySelector<HTMLButtonElement>('.minecraft-start')!.disabled = false; this.root.querySelector<HTMLElement>('.minecraft-entry')!.hidden = false; this.root.querySelector<HTMLElement>('.minecraft-stop')!.hidden = true; this.root.querySelector<HTMLElement>('.minecraft-attack')!.hidden = true; this.error('')
  }
  private attack() {
    if (!this.active || !this.stream || this.loading) return
    const now = performance.now(); this.swingAt = now
    if (this.mask && hitsCenter(this.mask, now - this.maskAt)) this.hurtAt = now
  }
  private async track(now: number) {
    const tracker = this.tracker
    if (!tracker || this.busy || now - this.lastSample < 100 || this.video.readyState < 2 || this.videoTime === this.video.currentTime) return
    this.lastSample = now; this.videoTime = this.video.currentTime; this.busy = true
    try {
      const sample = await tracker.sample(this.video, now, true)
      if (tracker !== this.tracker) return
      this.mask = sample.mask; this.maskAt = performance.now()
      if (this.mask) {
        const { width, height, data } = this.mask; this.maskCanvas.width = width; this.maskCanvas.height = height
        const ctx = this.maskCanvas.getContext('2d')!, image = ctx.createImageData(width, height)
        for (let i = 0; i < data.length; i++) { image.data[i * 4] = 255; image.data[i * 4 + 3] = data[i] ? 140 : 0 }
        ctx.putImageData(image, 0, 0); this.hurt.width = width; this.hurt.height = height
      }
    } catch {
      if (tracker === this.tracker) { this.stop(); this.error('사람 인식이 중단됐어요. 카메라를 다시 켜 주세요.') }
    } finally { if (tracker === this.tracker) this.busy = false }
  }
  private tick = (now: number) => {
    if (!this.active || !this.stream) return
    void this.track(now)
    const progress = Math.min(1, Math.max(0, (now - this.swingAt) / swingDuration)), motion = swingMotion(progress), aspect = this.camera.right
    this.grip.position.set(aspect * .72 + motion.x, -.82 + motion.y, motion.z)
    this.grip.rotation.set(THREE.MathUtils.degToRad(motion.rotateX), THREE.MathUtils.degToRad(motion.rotateY), THREE.MathUtils.degToRad(motion.rotateZ))
    this.renderer.render(this.scene, this.camera)
    const ctx = this.hurt.getContext('2d')!; ctx.clearRect(0, 0, this.hurt.width, this.hurt.height)
    if (now - this.hurtAt < 300 && now - this.maskAt < 600 && this.mask) ctx.drawImage(this.maskCanvas, 0, 0)
    this.frame = requestAnimationFrame(this.tick)
  }
}
