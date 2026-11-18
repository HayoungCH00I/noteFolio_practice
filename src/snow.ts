import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { FruitTracker } from './fruit-tracker.ts'
import type { TrackingSample } from './fruit-vision.ts'
import { coverPoint, handPose, type Point } from './fruit-game-core.ts'
import { HumanSurface, SnowPhysics } from './snow-physics.ts'
import { SnowBeard, HeadShake, beardPatterns, type BeardStyle } from './snow-beard.ts'
import { SnowFog } from './snow-fog.ts'

type Cloud = { x: number; y: number; width: number; phase: number; rainUntil: number; lastPoke: number; emission: number; touchSince: number }
type FaceFrame = { x: number; y: number; width: number; angle: number; mouthX: number; mouthY: number; noseX: number; noseY: number; chinX: number; chinY: number; open: boolean }
export class SnowScene {
  private root: HTMLElement
  private video: HTMLVideoElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private tracker?: FruitTracker
  private stream?: MediaStream
  private physics = new SnowPhysics()
  private beard = new SnowBeard()
  private shake = new HeadShake()
  private fog?: SnowFog
  private clouds: Cloud[] = []
  private cloudArt?: HTMLCanvasElement
  private flakeArt?: HTMLCanvasElement
  private active = false
  private loading = false
  private frame = 0
  private token = 0
  private width = 1
  private height = 1
  private last = 0
  private lastInference = 0
  private lastFull = 0
  private videoTime = -1
  private busy = false
  private maskAt = 0
  private faceAt = 0
  private face?: FaceFrame
  private tip?: Point
  private previousTip?: Point & { time: number }
  private breathAt = 0
  private statusUntil = 0
  private lastProgress = ''
  private progress: HTMLElement
  private status: HTMLElement
  constructor(root: HTMLElement) {
    this.root = root; this.video = root.querySelector('video')!; this.canvas = root.querySelector('canvas')!; this.ctx = this.canvas.getContext('2d')!; this.progress = root.querySelector('.snow-progress')!; this.status = root.querySelector('.snow-status')!
    root.querySelector('.snow-start')!.addEventListener('click', () => { void this.start() })
    root.querySelector('.snow-stop')!.addEventListener('click', () => this.stop())
    root.querySelector('.snow-clear')!.addEventListener('click', () => { this.clear(); this.say('겨울, 다시 처음부터. 구름을 톡 찔러보세요.') })
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-beard]')) button.addEventListener('click', () => {
      this.beard.choose(Number(button.dataset.beard) as BeardStyle)
      for (const other of root.querySelectorAll<HTMLButtonElement>('[data-beard]')) other.setAttribute('aria-pressed', String(other === button))
      this.say('새로운 모양으로 눈 수염을 만들어볼까요?')
    })
    new ResizeObserver(() => this.resize()).observe(root)
    document.addEventListener('visibilitychange', () => {
      if (!this.active) return
      if (document.hidden) { cancelAnimationFrame(this.frame); this.frame = 0; this.previousTip = this.tip = undefined }
      else { this.last = 0; this.maskAt = this.faceAt = 0; this.physics.surface = undefined; this.wake() }
    })
  }
  setActive(active: boolean) {
    if (this.active === active) return
    this.active = active
    if (active) { this.resize(); this.wake() }
    else { cancelAnimationFrame(this.frame); this.frame = 0; this.stop() }
  }
  private resize() {
    const rect = this.root.getBoundingClientRect(); if (!rect.width || !rect.height) return
    const oldW = this.width, oldH = this.height; this.width = rect.width; this.height = rect.height
    const dpr = Math.min(devicePixelRatio || 1, 2); this.canvas.width = this.width * dpr; this.canvas.height = this.height * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    for (const p of this.physics.particles) { p.x *= this.width / oldW; p.y *= this.height / oldH }
    this.physics.surface = undefined; this.fog = new SnowFog(this.width, this.height)
    this.clouds = Array.from({ length: this.width > 700 ? 4 : 3 }, (_, i) => ({ x: (i + .7) / (this.width > 700 ? 4.4 : 3.4), y: i % 2 ? .34 : .25, width: Math.max(105, Math.min(175, this.width * .2)), phase: i * 1.8, rainUntil: 0, lastPoke: -Infinity, emission: 0, touchSince: 0 }))
    this.previousTip = undefined; this.cloudArt = undefined; this.flakeArt = undefined; this.wake()
  }
  private say(text: string) { if (this.status.textContent !== text) this.status.textContent = text; this.statusUntil = performance.now() + 3500 }
  private error(text: string) { this.root.querySelector('.snow-error')!.textContent = text }
  private async start() {
    if (!this.active || this.loading || this.stream) return
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { this.error('카메라는 localhost 또는 HTTPS에서 켤 수 있어요. 일반 HTTP 네트워크 주소 대신 안전한 주소로 접속해 주세요.'); return }
    this.loading = true; const token = ++this.token
    const button = this.root.querySelector<HTMLButtonElement>('.snow-start')!; button.disabled = true; this.error('카메라 사용을 허용해 주세요.')
    let tracker: FruitTracker | undefined
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }, audio: false })
      if (!this.active || token !== this.token) { stream.getTracks().forEach(track => track.stop()); return }
      this.stream = stream; this.video.srcObject = stream; await this.video.play()
      if (!this.active || token !== this.token) return
      this.root.querySelector<HTMLElement>('.snow-stop')!.hidden = false; this.error('손·얼굴·사람 윤곽을 준비하고 있어요. 잠시만 기다려 주세요.')
      tracker = new FruitTracker('snow'); this.tracker = tracker
      await tracker.init(new URL(`${import.meta.env.BASE_URL}mediapipe`, location.href).href)
      if (!this.active || token !== this.token) { tracker.close(); return }
      this.clear(); this.root.querySelector<HTMLElement>('.snow-entry')!.hidden = true; this.last = 0; this.lastFull = this.lastInference = 0; this.videoTime = -1; this.busy = false
      this.say('검지만 펴고 구름을 톡 찔러보세요 ☝'); this.wake()
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (token === this.token) { this.stop(); this.error('카메라 연결이 끝났어요. 다시 켜 주세요.') } }, { once: true })
    } catch (error) {
      tracker?.close(); if (token !== this.token) return
      this.stop(); const name = error instanceof Error ? error.name : ''
      this.error(name === 'NotAllowedError' ? '카메라 권한을 허용한 뒤 다시 눌러 주세요.' : name === 'NotFoundError' ? '연결된 카메라를 찾지 못했어요.' : name === 'NotReadableError' ? '다른 앱이 카메라를 사용하고 있는지 확인해 주세요.' : '사람 윤곽과 손 추적을 준비하지 못했어요. 새로고침한 뒤 다시 시도해 주세요.')
    } finally { if (token === this.token) { this.loading = false; button.disabled = false } }
  }
  private stop() {
    this.token++; this.tracker?.close(); this.tracker = undefined; this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined; this.video.pause(); this.video.srcObject = null; this.loading = false; this.busy = false
    this.root.querySelector<HTMLButtonElement>('.snow-start')!.disabled = false; this.root.querySelector<HTMLElement>('.snow-stop')!.hidden = true; this.root.querySelector<HTMLElement>('.snow-entry')!.hidden = false
    this.clear(); this.error(''); this.say('카메라를 켜고 겨울을 불러보세요'); this.wake()
  }
  private clear() {
    this.physics = new SnowPhysics(); this.beard.choose(this.beard.style); this.shake = new HeadShake(); this.fog?.clear(); this.face = this.tip = this.previousTip = undefined; this.maskAt = this.faceAt = 0
    for (const cloud of this.clouds) { cloud.rainUntil = 0; cloud.emission = 0; cloud.touchSince = 0 }
    this.ctx.clearRect(0, 0, this.width, this.height); this.lastProgress = ''
  }
  private map(point: Point) { return coverPoint(point, this.video.videoWidth || 960, this.video.videoHeight || 720, this.width, this.height) }
  private cloudPosition(cloud: Cloud, now: number) { return { x: cloud.x * this.width + Math.sin(now / 3200 + cloud.phase) * 24, y: Math.max(190, cloud.y * this.height) + Math.sin(now / 2400 + cloud.phase) * 9 } }
  private snowing(now: number) { return this.clouds.some(cloud => cloud.rainUntil > now) }
  private async track(now: number) {
    if (!this.tracker || this.busy || this.video.readyState < 2 || this.video.currentTime === this.videoTime || now - this.lastInference < 50) return
    const token = this.token, full = now - this.lastFull >= 125
    this.lastInference = now; this.videoTime = this.video.currentTime; if (full) this.lastFull = now; this.busy = true
    try {
      const sample = await this.tracker.sample(this.video, now, full)
      if (token === this.token && this.active && !document.hidden && this.stream) this.process(sample, performance.now())
    } catch { if (token === this.token) { this.stop(); this.error('추적이 중단됐어요. 카메라를 다시 켜 주세요.') } }
    finally { if (token === this.token) this.busy = false }
  }
  private process(sample: TrackingSample, now: number) {
    if (sample.mask) { const visible = sample.mask.data.some(value => value > 0); this.physics.surface = visible ? new HumanSurface(sample.mask, this.video.videoWidth, this.video.videoHeight, this.width, this.height) : undefined; this.maskAt = visible ? now : 0 }
    if (sample.faces?.length) this.updateFace(sample.faces, now)
    else if (sample.faces) this.faceAt = 0
    if (sample.landmarks.length && handPose(sample.world.length ? sample.world : sample.landmarks) === 'index') {
      const point = this.map(sample.landmarks[8]!), previous = this.previousTip
      const continuous = !!previous && sample.timestamp - previous.time < 200 && Math.hypot(point.x - previous.x, point.y - previous.y) < Math.min(this.width, this.height) * .6
      this.tip = point
      this.fog?.wipe(continuous ? previous! : point, point, Math.max(15, this.width * .017))
      for (const cloud of this.clouds) {
        const position = this.cloudPosition(cloud, now), within = Math.hypot((point.x - position.x) / (cloud.width * .53), (point.y - position.y) / (cloud.width * .28)) < 1
        if (within) {
          if (!cloud.touchSince) cloud.touchSince = now
          if (now - cloud.touchSince > 100 && now - cloud.lastPoke > 1500) { cloud.rainUntil = now + 8500; cloud.lastPoke = now; this.say('톡! 겨울이 내리기 시작했어요 ❄') }
        } else cloud.touchSince = 0
      }
      if (continuous && this.beard.growth >= 1 && this.face && now - this.faceAt < 500 && this.beardHit(point, this.face)) {
        this.beard.stroke(point.x - previous!.x, point.y - previous!.y, this.face.width); this.say('소복한 눈 수염을 살살 쓰다듬는 중…')
      }
      this.previousTip = { ...point, time: sample.timestamp }
    } else { this.previousTip = this.tip = undefined; for (const cloud of this.clouds) cloud.touchSince = 0 }
  }
  private updateFace(points: NormalizedLandmark[], now: number) {
    const left = this.map(points[234]!), right = this.map(points[454]!), upper = this.map(points[13]!), lower = this.map(points[14]!), ml = this.map(points[61]!), mr = this.map(points[291]!), nose = this.map(points[2]!), chin = this.map(points[152]!)
    const width = Math.hypot(right.x - left.x, right.y - left.y), angle = Math.atan2(right.y - left.y, right.x - left.x) + (right.x < left.x ? Math.PI : 0)
    this.face = { x: (left.x + right.x) / 2, y: upper.y, width, angle, mouthX: (upper.x + lower.x) / 2, mouthY: (upper.y + lower.y) / 2, noseX: nose.x, noseY: nose.y, chinX: chin.x, chinY: chin.y, open: Math.hypot(upper.x - lower.x, upper.y - lower.y) / Math.max(1, Math.hypot(ml.x - mr.x, ml.y - mr.y)) > .24 }; this.faceAt = now
    if (this.face.open && this.snowing(now) && now - this.breathAt > 95) { this.fog?.breath(this.face.mouthX, this.face.mouthY, width); this.breathAt = now }
    if (this.shake.sample(points[1]!.x * 3, angle, now) && this.beard.growth > .08) this.shakeOff()
  }
  private beardOrigin(face: FaceFrame) {
    return { x: this.beard.style === 2 ? face.chinX : this.beard.style === 0 ? (face.noseX + face.mouthX) / 2 : face.mouthX, y: this.beard.style === 0 ? (face.noseY + face.y) / 2 : this.beard.style === 2 ? face.chinY : face.y }
  }
  private beardHit(point: Point, face: FaceFrame) {
    const origin = this.beardOrigin(face), dx = (point.x - origin.x) / face.width, dy = (point.y - origin.y) / face.width, c = Math.cos(face.angle), s = Math.sin(face.angle), x = dx * c + dy * s, y = -dx * s + dy * c
    return this.beard.style === 0 ? Math.abs(x) < .17 && y > -.06 && y < .19 : this.beard.style === 1 ? Math.abs(x) < .48 && y > -.06 && y < 1.02 : Math.abs(x) < .15 && y > -.06 && y < .72
  }
  private grainPosition(grain: { x: number; y: number }, face: FaceFrame) {
    const origin = this.beardOrigin(face), depth = Math.max(0, grain.y), x = (grain.x + this.beard.bend * depth * .7) * face.width, y = (grain.y + this.beard.lift * depth * .45) * (this.beard.style === 0 ? Math.max(6, Math.abs(face.y - face.noseY) * .7) / .12 : face.width)
    return { x: origin.x + x * Math.cos(face.angle) - y * Math.sin(face.angle), y: origin.y + x * Math.sin(face.angle) + y * Math.cos(face.angle) }
  }
  private shakeOff() {
    if (!this.face) return
    const points = beardPatterns[this.beard.style]!, count = Math.floor(points.length * this.beard.growth)
    for (let i = 0; i < count; i += 2) { const p = this.grainPosition(points[i]!, this.face); this.physics.add(p.x, p.y, points[i]!.radius * this.face.width * .65, (Math.random() - .5) * 220, -50 - Math.random() * 70, .75) }
    this.beard.shakeOff(); this.say('후두둑! 눈 수염을 털어냈어요 ❄')
  }
  private wake() { if (this.active && !document.hidden && !this.frame) this.frame = requestAnimationFrame(this.tick) }
  private tick = (now: number) => {
    this.frame = 0; if (!this.active || document.hidden) return
    const dt = this.last ? Math.min(.05, (now - this.last) / 1000) : 0; this.last = now
    if (this.stream && !this.loading) {
      void this.track(now)
      if (now - this.maskAt > 650) this.physics.surface = undefined
      for (const cloud of this.clouds) if (cloud.rainUntil > now) {
        cloud.emission += dt * 36
        const position = this.cloudPosition(cloud, now)
        while (cloud.emission >= 1) { cloud.emission--; this.physics.add(position.x + (Math.random() - .5) * cloud.width * .95, position.y + cloud.width * .22) }
      }
      this.physics.step(dt, this.width, this.height); this.beard.step(dt, this.snowing(now), now - this.faceAt < 500); this.fog?.step(dt)
      const text = this.beard.growth >= 1 ? '수염 완성! 검지로 살살 쓰다듬어보세요' : this.beard.growth > 0 ? `눈 수염이 소복소복… ${Math.floor(this.beard.growth * 100)}%` : '눈이 내리면 수염이 자라요'
      if (text !== this.lastProgress) { this.progress.textContent = text; this.lastProgress = text }
      if (now > this.statusUntil) { const text = !this.maskAt || now - this.maskAt > 650 ? '사람 윤곽을 찾는 중… 몸이 카메라에 보이게 해주세요' : this.snowing(now) ? '입을 벌려 김을 만들고, 검지로 그려보세요' : '검지만 펴서 구름을 톡 찔러보세요 ☝'; if (this.status.textContent !== text) this.status.textContent = text }
    }
    this.render(now)
    if (this.stream && !this.loading) this.wake()
  }
  private render(now: number) {
    const ctx = this.ctx; ctx.clearRect(0, 0, this.width, this.height)
    if (this.fog && this.fog.amount > .004) ctx.drawImage(this.fog.image(this.video, now), 0, 0, this.width, this.height)
    this.ensureArt()
    for (const p of this.physics.particles) { ctx.globalAlpha = Math.min(1, (45 - p.age) / 4) * .95; const radius = p.radius * 1.6; ctx.drawImage(this.flakeArt!, p.x - radius, p.y - radius, radius * 2, radius * 2) }; ctx.globalAlpha = 1
    if (this.face && now - this.faceAt < 500) {
      const points = beardPatterns[this.beard.style]!, count = Math.floor(points.length * this.beard.growth)
      for (let i = 0; i < count; i++) { const p = points[i]!, at = this.grainPosition(p, this.face), radius = p.radius * this.face.width; ctx.fillStyle = p.shade > .6 ? '#d8e8f1' : '#f8fdff'; ctx.beginPath(); ctx.arc(at.x, at.y, radius, 0, Math.PI * 2); ctx.fill() }
    }
    for (const cloud of this.clouds) {
      const p = this.cloudPosition(cloud, now)
      if (cloud.rainUntil > now) { ctx.save(); ctx.fillStyle = '#d2f1ff50'; ctx.beginPath(); ctx.ellipse(p.x, p.y + cloud.width * .14, cloud.width * .5, cloud.width * .2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
      ctx.drawImage(this.cloudArt!, p.x - cloud.width * .6, p.y - cloud.width * .4, cloud.width * 1.2, cloud.width * .8)
    }
    if (this.tip) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#a6d6e9'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.tip.x, this.tip.y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke() }
  }
  private ensureArt() {
    if (!this.flakeArt) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32; const ctx = canvas.getContext('2d')!, gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16); gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.5, '#f5fcffff'); gradient.addColorStop(1, '#e7f5ff00'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 32); this.flakeArt = canvas
    }
    if (!this.cloudArt) {
      const canvas = document.createElement('canvas'); canvas.width = 360; canvas.height = 240; const ctx = canvas.getContext('2d')!; ctx.shadowColor = '#416c8b30'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8
      const gradient = ctx.createLinearGradient(0, 50, 0, 190); gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(1, '#cee4f2'); ctx.fillStyle = gradient
      ctx.beginPath(); ctx.moveTo(70, 175); ctx.bezierCurveTo(0, 160, 28, 75, 95, 100); ctx.bezierCurveTo(86, 20, 212, 23, 217, 88); ctx.bezierCurveTo(288, 50, 330, 104, 293, 136); ctx.bezierCurveTo(358, 139, 319, 190, 263, 180); ctx.closePath(); ctx.fill(); this.cloudArt = canvas
    }
  }
}
