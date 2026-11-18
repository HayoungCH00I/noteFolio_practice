import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { FruitRound, coverPoint, handPose, type HandPose, type FlyingFruit, type Point } from './fruit-game-core.ts'
import { FruitTracker } from './fruit-tracker.ts'
import type { TrackingSample } from './fruit-vision.ts'
import { drawFruit } from './fruit-art.ts'

export const fruitSlashMarkup = `<main class="fruit-page app-page" id="page-ninth" hidden>
  <video class="fruit-camera" autoplay muted playsinline aria-label="거울처럼 반전된 내 카메라 화면"></video>
  <div class="fruit-camera-shade" aria-hidden="true"></div>
  <canvas class="fruit-canvas" aria-hidden="true"></canvas>
  <header class="fruit-heading"><span>WEEK 03 / EXAMPLE 08</span><h1>Ninja Fruit Slash<span>검지 하나로, 싹.</span></h1></header>
  <div class="fruit-score" aria-label="베어낸 과일 수"><span>SLICED</span><strong>0</strong></div>
  <div class="fruit-timer"><span>TIME LEFT</span><strong><b>60</b><span>s</span></strong><div><i></i></div></div>
  <div class="fruit-tracking" role="status"><i></i><span>카메라를 켜 주세요</span></div>
  <div class="fruit-overlay"><section class="fruit-start-card"><span class="fruit-eyebrow">A LITTLE MOTION. A LOT OF JUICE.</span><div class="fruit-card-art" aria-hidden="true">🍉 <span>✦</span> 🍑</div><h2>손끝이 칼이 되는 시간.</h2><p>다른 손가락은 접고 <strong>검지만 펴 주세요.</strong><br>카메라를 향해 검지를 쓱 그으면 과일이 반으로!</p><div class="fruit-rules"><span>60초 동안 도전</span><span>연속으로 베면 콤보</span><span>폭탄은 피하기</span><span>🖐 멈춤 · ✊ 재개</span></div><button class="fruit-start" type="button">카메라 켜고 시작하기 ↗</button><p class="fruit-message" role="status" aria-live="polite"></p><small>카메라 영상은 이 기기에서만 처리해요.</small></section></div>
  <div class="fruit-results" hidden><section class="fruit-start-card"><span class="fruit-eyebrow">TIME'S UP!</span><h2>오늘의 손끝 실력은?</h2><strong class="fruit-final-score">0</strong><p>개의 과일을 베었어요</p><div class="fruit-result-detail"></div><button class="fruit-again" type="button">다시 60초 도전 ↗</button><small>카메라는 꺼졌어요. 다시 도전하면 켜집니다.</small></section></div>
  <div class="fruit-paused" hidden role="status" aria-live="polite"><strong>일시정지</strong><span>주먹을 쥐면 3초 후 다시 시작해요 ✊</span></div>
  <footer class="fruit-footer"><p>검지만 펴고 과일을 가로질러 쓱! <span>☝ 베기 · 🖐 일시정지 · ✊ 3초 후 재개</span></p><div><button class="fruit-sound" type="button" aria-pressed="true">소리 켜짐 ♪</button><button class="fruit-stop" type="button" hidden>카메라 끄기</button></div></footer>
</main>`
type Trail = Point & { time: number; start: boolean }
type Piece = FlyingFruit & { side: -1 | 1; cut: number; life: number }
type Splash = Point & { vx: number; vy: number; life: number; color: string; radius: number }
type ComboLabel = Point & { text: string; life: number; color: string }

export class FruitSlash {
  private root: HTMLElement
  private video: HTMLVideoElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private game = new FruitRound()
  private active = false
  private generation = 0
  private loading = false
  private width = 1
  private height = 1
  private frame = 0
  private last = 0
  private lastInference = 0
  private lastVideoTime = -1
  private lastFace = 0
  private faceSeen = 0
  private faces: NormalizedLandmark[] = []
  private tracker?: FruitTracker
  private frameBusy = false
  private stream?: MediaStream
  private trail: Trail[] = []
  private previousTip?: Point & { time: number }
  private currentTip?: Point
  private poseFrames = 0
  private pieces: Piece[] = []
  private splashes: Splash[] = []
  private labels: ComboLabel[] = []
  private bombUntil = 0
  private flashUntil = 0
  private readyAt = 0
  private soundAt = 0
  private audio?: AudioContext
  private muted = false
  private resultShown = false
  private resumeAt = 0
  private gesture: HandPose = 'other'
  private gestureSince = 0
  private dirty = true
  private lastCountdown = -1
  private lastScore = -1
  private lastSeconds = -1
  private trackingText = ''
  private trackingValid = false
  private scoreView: HTMLElement
  private timeView: HTMLElement
  private timeBar: HTMLElement
  private trackingView: HTMLElement
  private trackingLabel: HTMLElement
  private pauseView: HTMLElement
  private pauseTitle: HTMLElement
  private pauseHint: HTMLElement
  private cutArt = new Map<string, HTMLCanvasElement>()
  private noise: AudioBuffer[] = []
  constructor(root: HTMLElement) {
    this.root = root; this.video = root.querySelector('video')!; this.canvas = root.querySelector('canvas')!; this.ctx = this.canvas.getContext('2d')!
    this.scoreView = root.querySelector('.fruit-score strong')!; this.timeView = root.querySelector('.fruit-timer b')!; this.timeBar = root.querySelector('.fruit-timer i')!
    this.trackingView = root.querySelector('.fruit-tracking')!; this.trackingLabel = root.querySelector('.fruit-tracking span')!
    this.pauseView = root.querySelector('.fruit-paused')!; this.pauseTitle = root.querySelector('.fruit-paused strong')!; this.pauseHint = root.querySelector('.fruit-paused span')!
    document.addEventListener('visibilitychange', () => {
      if (!this.active) return
      if (document.hidden) { if (this.game.running) this.pause(performance.now()); this.resumeAt = 0; this.pauseTitle.textContent = '일시정지'; this.pauseHint.textContent = '주먹을 쥐면 3초 후 다시 시작해요 ✊'; cancelAnimationFrame(this.frame); this.frame = 0; void this.audio?.suspend() }
      else { this.last = 0; this.dirty = true; void this.audio?.resume(); this.wake() }
    })
    for (const selector of ['.fruit-start', '.fruit-again']) root.querySelector(selector)!.addEventListener('click', () => { this.unlockSound(); void this.start() })
    root.querySelector('.fruit-stop')!.addEventListener('click', () => this.stop())
    root.querySelector('.fruit-sound')!.addEventListener('click', () => { this.muted = !this.muted; this.unlockSound(); root.querySelector('.fruit-sound')!.textContent = this.muted ? '소리 꺼짐' : '소리 켜짐 ♪'; root.querySelector('.fruit-sound')!.setAttribute('aria-pressed', String(!this.muted)) })
    new ResizeObserver(() => this.resize()).observe(root)
  }
  setActive(active: boolean) {
    if (this.active === active) return
    this.active = active
    if (active) { this.resize(); this.last = 0; this.wake() }
    else { cancelAnimationFrame(this.frame); this.frame = 0; this.stop(); void this.audio?.suspend() }
  }
  private resize() {
    const rect = this.root.getBoundingClientRect(); if (!rect.width || !rect.height) return
    const oldWidth = this.width, oldHeight = this.height
    this.width = rect.width; this.height = rect.height
    const dpr = Math.min(devicePixelRatio || 1, 2)
    this.canvas.width = this.width * dpr; this.canvas.height = this.height * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (this.game.object) { this.game.object.x *= this.width / oldWidth; this.game.object.y *= this.height / oldHeight; this.game.object.vy *= Math.sqrt(this.height / oldHeight) }
    this.trail = []; this.previousTip = undefined; this.cutArt.clear(); this.dirty = true; this.wake()
  }
  private message(text: string) { this.root.querySelector('.fruit-message')!.textContent = text }
  private loadingState(loading: boolean) { this.loading = loading; for (const button of this.root.querySelectorAll<HTMLButtonElement>('.fruit-start, .fruit-again')) button.disabled = loading }
  private async start() {
    if (!this.active || this.loading || this.game.running || this.readyAt) return
    this.root.querySelector<HTMLElement>('.fruit-results')!.hidden = true
    this.root.querySelector<HTMLElement>('.fruit-overlay')!.hidden = false
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.message('카메라는 HTTPS 또는 localhost에서 사용할 수 있어요. 이 컴퓨터에서는 localhost 주소로, 다른 기기에서는 HTTPS 주소로 접속해 주세요.'); return
    }
    const token = ++this.generation
    this.loadingState(true); this.message('카메라 권한을 허용해 주세요.'); this.resultShown = false
    let newTracker: FruitTracker | undefined
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } }, audio: false })
      if (token !== this.generation || !this.active) { stream.getTracks().forEach(track => track.stop()); return }
      this.stream = stream; this.video.srcObject = stream; await this.video.play()
      if (token !== this.generation || !this.active) return
      this.root.querySelector<HTMLButtonElement>('.fruit-stop')!.hidden = false
      this.message('손과 얼굴을 알아보는 중이에요. 처음에는 잠시 걸릴 수 있어요.')
      if (!this.tracker) {
        newTracker = new FruitTracker(); this.tracker = newTracker
        await newTracker.init(new URL(`${import.meta.env.BASE_URL}mediapipe`, location.href).href)
        if (token !== this.generation || !this.active) { newTracker.close(); return }
      }
      if (token !== this.generation || !this.active) return
      this.game = new FruitRound(); this.pieces = []; this.splashes = []; this.labels = []; this.trail = []; this.faces = []; this.currentTip = undefined; this.previousTip = undefined; this.poseFrames = 0; this.bombUntil = this.flashUntil = 0; this.lastInference = this.lastFace = this.faceSeen = 0; this.lastVideoTime = -1
      this.resumeAt = 0; this.gesture = 'other'; this.gestureSince = 0; this.frameBusy = false; this.lastCountdown = -1; this.lastScore = this.lastSeconds = -1; this.dirty = true; this.pauseView.hidden = true
      this.readyAt = performance.now() + 3000; this.wake()
      this.root.querySelector<HTMLElement>('.fruit-overlay')!.hidden = true
      this.tracking('검지만 펴고 준비해 주세요', false)
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (token === this.generation && this.active) { this.stop(); this.message('카메라 연결이 끝났어요. 다시 켜 주세요.') } }, { once: true })
    } catch (error) {
      newTracker?.close()
      if (token !== this.generation) return
      this.releaseCamera(); this.tracker?.close(); this.tracker = undefined
      const name = error instanceof Error ? error.name : ''
      this.message(name === 'NotAllowedError' ? '카메라 권한이 필요해요. 주소창의 카메라 권한을 허용한 뒤 다시 눌러 주세요.' : name === 'NotFoundError' ? '카메라를 찾지 못했어요. 연결된 카메라가 있는지 확인해 주세요.' : name === 'NotReadableError' ? '다른 앱이 카메라를 사용하고 있을 수 있어요. 사용 중인 앱을 닫고 다시 시도해 주세요.' : '손·얼굴 추적을 준비하지 못했어요. 페이지를 새로고침하고 다시 시도해 주세요.')
    } finally { if (token === this.generation) this.loadingState(false) }
  }
  private releaseCamera() { this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined; this.video.pause(); this.video.srcObject = null; this.root.querySelector<HTMLButtonElement>('.fruit-stop')!.hidden = true }
  private stop() {
    this.generation++; this.readyAt = this.resumeAt = 0; this.game.running = false; this.game.paused = false; this.tracker?.close(); this.tracker = undefined; this.frameBusy = false; this.game.object = undefined; this.releaseCamera(); this.loadingState(false)
    this.trail = []; this.pieces = []; this.splashes = []; this.labels = []; this.currentTip = undefined; this.previousTip = undefined; this.bombUntil = 0; this.faces = []
    this.root.querySelector<HTMLElement>('.fruit-overlay')!.hidden = false; this.root.querySelector<HTMLElement>('.fruit-results')!.hidden = true; this.message(''); this.pauseView.hidden = true; this.dirty = true; this.tracking('카메라를 켜 주세요', false); this.wake()
  }
  private tracking(text: string, valid: boolean) {
    if (text !== this.trackingText) { this.trackingLabel.textContent = text; this.trackingText = text }
    if (valid !== this.trackingValid) { this.trackingView.classList.toggle('is-ready', valid); this.trackingValid = valid }
  }
  private map(point: Point) { return coverPoint(point, this.video.videoWidth || 960, this.video.videoHeight || 720, this.width, this.height) }
  private pause(now: number) {
    if (!this.game.pause(now)) return
    this.resumeAt = 0; this.trail.length = 0; this.previousTip = this.currentTip = undefined; this.poseFrames = 0
    this.pauseView.hidden = false; this.pauseTitle.textContent = '일시정지'; this.pauseHint.textContent = '주먹을 쥐면 3초 후 다시 시작해요 ✊'; this.dirty = true
    this.tracking('🖐 일시정지 · 주먹을 쥐어 재개하세요', false)
  }
  private resume(now: number) {
    const duration = this.game.resume(now)
    if (this.bombUntil) this.bombUntil += duration
    if (this.flashUntil) this.flashUntil += duration
    this.resumeAt = 0; this.pauseView.hidden = true; this.previousTip = this.currentTip = undefined; this.poseFrames = 0; this.trail.length = 0; this.last = now; this.dirty = true
  }
  private async track(now: number) {
    const interval = this.game.paused && !this.resumeAt ? 100 : 40
    if (!this.tracker || this.frameBusy || !this.stream || this.video.readyState < 2 || this.video.currentTime === this.lastVideoTime || now - this.lastInference < interval) return
    this.lastVideoTime = this.video.currentTime; this.lastInference = now; this.frameBusy = true
    const token = this.generation, effectTime = this.game.paused ? this.game.pausedAt : now
    const withFace = this.bombUntil > effectTime && now - this.lastFace > 95
    if (withFace) this.lastFace = now
    try {
      const sample = await this.tracker.sample(this.video, now, withFace)
      if (token !== this.generation || !this.active || !this.stream || (!this.game.running && !this.readyAt)) return
      this.processSample(sample, performance.now())
    } catch {
      if (token === this.generation) { this.stop(); this.message('손 추적이 중단됐어요. 카메라 켜기를 눌러 다시 시도해 주세요.') }
    } finally { if (token === this.generation) this.frameBusy = false }
  }
  private processSample(sample: TrackingSample, now: number) {
    if (sample.faces) { this.faces = sample.faces; if (this.faces.length) this.faceSeen = now; this.dirty = true }
    const landmarks = sample.landmarks, pose = handPose(sample.world.length ? sample.world : landmarks)
    if (pose !== this.gesture) { this.gesture = pose; this.gestureSince = now }
    if (this.game.running && pose === 'open' && now - this.gestureSince >= 140) {
      if (!this.game.paused) this.pause(now)
      else if (this.resumeAt) { this.resumeAt = 0; this.pauseTitle.textContent = '일시정지'; this.pauseHint.textContent = '주먹을 쥐면 3초 후 다시 시작해요 ✊' }
    }
    if (this.game.paused) {
      if (pose === 'fist' && !this.resumeAt && now - this.gestureSince >= 140) {
        this.resumeAt = now + 3000; this.lastCountdown = -1; this.pauseHint.textContent = '잠시 후 멈춘 자리에서 이어가요'
      }
      this.tracking(this.resumeAt ? '✊ 3초 후 다시 시작해요' : '🖐 일시정지 · 주먹을 쥐어 재개하세요', false)
      return
    }
    if (pose !== 'index') {
      this.poseFrames = 0; this.previousTip = undefined; this.currentTip = undefined
      this.tracking(landmarks.length ? '다른 손가락은 접고 검지만 펴 주세요 ☝' : '카메라에 손을 보여 주세요', false)
      return
    }
    this.poseFrames++
    const raw = this.map(landmarks[8]!), timestamp = sample.timestamp
    const tip = this.currentTip ? { x: this.currentTip.x * .3 + raw.x * .7, y: this.currentTip.y * .3 + raw.y * .7 } : raw
    const previous = this.previousTip
    const continuous = !!previous && timestamp - previous.time < 140 && Math.hypot(tip.x - previous.x, tip.y - previous.y) < Math.min(this.width, this.height) * .65
    this.currentTip = tip; this.trail.push({ ...tip, time: timestamp, start: !continuous }); this.previousTip = { ...tip, time: timestamp }
    this.tracking('검지 인식 완료 · 과일을 쓱 베어 보세요!', true)
    if (continuous && this.poseFrames >= 2) {
      const distance = Math.hypot(tip.x - previous!.x, tip.y - previous!.y), speed = distance * 1000 / (timestamp - previous!.time)
      if (distance > 8 && speed > 160) {
        this.swish(now, speed)
        const sliced = this.game.slash(previous!, tip, now)
        if (sliced) this.slice(sliced, Math.atan2(tip.y - previous!.y, tip.x - previous!.x), tip, now)
      }
    }
  }
  private slice(object: FlyingFruit, cut: number, point: Point, now: number) {
    if (object.kind === 'bomb') {
      this.bombUntil = now + 4200; this.flashUntil = now + 350
      this.labels.push({ ...point, text: 'BOOM! 콤보 초기화', life: 1.4, color: '#ffb0a0' }); this.explosionSound()
    } else {
      for (const side of [-1, 1] as const) this.pieces.push({ ...object, side, cut, vx: object.vx - Math.sin(cut) * side * 150, vy: object.vy * .3 + Math.cos(cut) * side * 120 - 90, spin: side * 2.8, life: 1.1 })
      if (this.game.combo >= 2) this.labels.push({ ...point, text: `+${this.game.combo}combo`, life: 1.1, color: '#fff6b8' })
      const colors = { watermelon: '#ff7783', peach: '#ffa4b7', apple: '#ff8a7b', avocado: '#d5ec80', pineapple: '#ffe385' }
      for (let i = 0; i < 20; i++) { const a = Math.random() * Math.PI * 2, v = 50 + Math.random() * 230; this.splashes.push({ x: object.x, y: object.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: .6 + Math.random() * .3, radius: 2 + Math.random() * 5, color: colors[object.kind] }) }
    }
  }
  private finish() {
    if (this.resultShown) return
    this.resultShown = true; this.readyAt = this.resumeAt = 0; this.pauseView.hidden = true; this.releaseCamera(); this.currentTip = undefined; this.previousTip = undefined
    this.root.querySelector('.fruit-final-score')!.textContent = String(this.game.score)
    this.root.querySelector('.fruit-result-detail')!.textContent = `최고 ${this.game.bestCombo}콤보 · 놓친 과일 ${this.game.misses}개 · 폭탄 ${this.game.bombs}회`
    this.root.querySelector<HTMLElement>('.fruit-results')!.hidden = false; this.tracking('60초 도전 완료!', false)
  }
  private wake() {
    if (this.active && !document.hidden && !this.frame) this.frame = requestAnimationFrame(this.tick)
  }
  private tick = (now: number) => {
    this.frame = 0
    if (!this.active || document.hidden) return
    const dt = this.last ? Math.min(.045, (now - this.last) / 1000) : 0; this.last = now
    const wasRunning = this.game.running
    if (this.readyAt && now >= this.readyAt) { this.readyAt = 0; this.game.start(now) }
    if (this.resumeAt) {
      const count = Math.max(1, Math.ceil((this.resumeAt - now) / 1000))
      if (count !== this.lastCountdown) { this.pauseTitle.textContent = String(count); this.lastCountdown = count }
      if (now >= this.resumeAt) this.resume(now)
    }
    this.game.step(now, dt, this.width, this.height)
    if (wasRunning && !this.game.running) this.finish()
    if (this.game.running || this.readyAt) void this.track(now)
    const paused = this.game.paused
    if (!paused || this.dirty) {
      this.render(paused ? this.game.pausedAt : now, paused ? 0 : dt, now)
      this.dirty = false
    }
    if (this.game.score !== this.lastScore) { this.scoreView.textContent = String(this.game.score); this.lastScore = this.game.score }
    const seconds = this.game.running ? Math.ceil(this.game.remaining(now) / 1000) : this.resultShown ? 0 : 60
    if (seconds !== this.lastSeconds) {
      this.timeView.textContent = String(seconds); this.timeBar.style.width = `${seconds / 60 * 100}%`; this.lastSeconds = seconds
      this.root.classList.toggle('is-ending', this.game.running && seconds <= 10)
    }
    if (this.stream && (this.game.running || this.readyAt) || this.pieces.length || this.splashes.length || this.labels.length || this.trail.length) this.wake()
  }
  private render(now: number, dt: number, frameNow: number) {
    const ctx = this.ctx; ctx.clearRect(0, 0, this.width, this.height)
    if (this.bombUntil > now) this.drawFace(now, frameNow)
    if (this.flashUntil > now) { ctx.fillStyle = `rgba(255,112,82,${(this.flashUntil - now) / 700})`; ctx.fillRect(0, 0, this.width, this.height) }
    const object = this.game.object
    if (object) { ctx.save(); ctx.translate(object.x, object.y); ctx.rotate(object.angle); ctx.shadowColor = '#0006'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 9; drawFruit(ctx, object.kind, object.radius); ctx.restore() }
    for (const piece of this.pieces) {
      piece.life -= dt; piece.vy += 750 * dt; piece.x += piece.vx * dt; piece.y += piece.vy * dt; piece.angle += piece.spin * dt
      ctx.save(); ctx.globalAlpha = Math.min(1, piece.life * 2); ctx.translate(piece.x, piece.y); ctx.rotate(piece.angle + piece.cut); ctx.beginPath(); ctx.rect(-piece.radius * 2, piece.side === 1 ? 0 : -piece.radius * 2, piece.radius * 4, piece.radius * 2); ctx.clip(); ctx.rotate(-piece.cut); this.drawCutFruit(piece.kind, piece.radius); ctx.restore()
    }
    this.pieces = this.pieces.filter(piece => piece.life > 0)
    for (const splash of this.splashes) { splash.life -= dt; splash.vy += 400 * dt; splash.x += splash.vx * dt; splash.y += splash.vy * dt; ctx.save(); ctx.globalAlpha = Math.max(0, splash.life); ctx.fillStyle = splash.color; ctx.beginPath(); ctx.arc(splash.x, splash.y, splash.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
    this.splashes = this.splashes.filter(splash => splash.life > 0)
    this.trail = this.trail.filter(point => now - point.time < 260)
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1]!, b = this.trail[i]!; if (b.start) continue
      const fade = 1 - (now - b.time) / 260
      ctx.save(); ctx.globalAlpha = fade; ctx.strokeStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 14; ctx.lineWidth = Math.max(1, fade * 7); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore()
    }
    if (this.currentTip) { ctx.save(); ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(this.currentTip.x, this.currentTip.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
    for (const label of this.labels) { label.life -= dt; label.y -= 38 * dt; ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, label.life * 3)); ctx.fillStyle = label.color; ctx.font = `800 ${Math.min(40, this.width * .065)}px Inter, sans-serif`; ctx.textAlign = 'center'; ctx.shadowColor = '#080b20'; ctx.shadowBlur = 10; ctx.fillText(label.text, Math.max(105, Math.min(this.width - 105, label.x)), label.y); ctx.restore() }
    this.labels = this.labels.filter(label => label.life > 0)
    if (this.readyAt) { ctx.save(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = '800 100px Inter, sans-serif'; ctx.shadowColor = '#0005'; ctx.shadowBlur = 20; ctx.fillText(String(Math.max(1, Math.ceil((this.readyAt - now) / 1000))), this.width / 2, this.height / 2); ctx.restore() }
  }
  private drawCutFruit(kind: FlyingFruit['kind'], radius: number) {
    const dpr = Math.min(devicePixelRatio || 1, 2), key = `${kind}:${radius}:${dpr}`
    let image = this.cutArt.get(key)
    const size = radius * 3.6
    if (!image) {
      image = document.createElement('canvas'); image.width = image.height = Math.ceil(size * dpr)
      const ctx = image.getContext('2d')!; ctx.scale(dpr, dpr); ctx.translate(size / 2, size / 2); drawFruit(ctx, kind, radius, true)
      this.cutArt.set(key, image)
    }
    this.ctx.drawImage(image, -size / 2, -size / 2, image.width / dpr, image.height / dpr)
  }
  private drawFace(now: number, frameNow: number) {
    if (!this.faces.length || frameNow - this.faceSeen > 300) {
      this.tracking('BOOM! 얼굴을 카메라에 보여 주세요', false); return
    }
    const top = this.map(this.faces[10]!), chin = this.map(this.faces[152]!), left = this.map(this.faces[234]!), right = this.map(this.faces[454]!)
    const cx = (left.x + right.x) / 2, cy = (top.y + chin.y) / 2, width = Math.hypot(right.x - left.x, right.y - left.y), height = Math.hypot(top.x - chin.x, top.y - chin.y)
    const ctx = this.ctx, alpha = Math.min(1, (this.bombUntil - now) / 600)
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.rotate(Math.atan2(right.y - left.y, right.x - left.x) + (right.x < left.x ? Math.PI : 0))
    ctx.fillStyle = '#18191ee6'; ctx.beginPath(); ctx.ellipse(0, 0, width * .48, height * .5, 0, 0, Math.PI * 2); ctx.fill()
    for (const eyeIndex of [159, 386]) { const eye = this.map(this.faces[eyeIndex]!); const dx = eye.x - cx, dy = eye.y - cy; ctx.save(); const rotation = Math.atan2(right.y - left.y, right.x - left.x) + (right.x < left.x ? Math.PI : 0); ctx.rotate(-rotation); ctx.fillStyle = '#fff9ed'; ctx.beginPath(); ctx.ellipse(dx, dy, width * .095, height * .06, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#20212a'; ctx.beginPath(); ctx.arc(dx, dy, width * .035, 0, Math.PI * 2); ctx.fill(); ctx.restore() }
    for (let i = 0; i < 27; i++) {
      const a = i * 2.399, r = Math.sqrt(i / 27), x = Math.cos(a) * width * .57 * r, y = -height * .52 + Math.sin(a) * height * .32 * r
      ctx.fillStyle = i % 3 === 0 ? '#25242b' : '#111219'; ctx.strokeStyle = '#3a3742'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(x, y, width * (.1 + i % 3 * .012), 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    }
    ctx.restore()
  }
  private unlockSound() { try { this.audio ??= new AudioContext(); void this.audio.resume() } catch { /* The visual game still works if audio is unavailable. */ } }
  private swish(now: number, speed: number) {
    if (now - this.soundAt < 130 || this.muted || !this.audio || this.audio.state !== 'running') return
    this.soundAt = now
    const audio = this.audio, duration = .16
    if (!this.noise.length) for (let n = 0; n < 3; n++) {
      const buffer = audio.createBuffer(1, audio.sampleRate * duration, audio.sampleRate), samples = buffer.getChannelData(0)
      for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / samples.length)
      this.noise.push(buffer)
    }
    const buffer = this.noise[Math.floor(Math.random() * this.noise.length)]!
    const source = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain()
    source.buffer = buffer; filter.type = 'bandpass'; filter.Q.value = .8; filter.frequency.setValueAtTime(Math.min(3600, 800 + speed), audio.currentTime); filter.frequency.exponentialRampToValueAtTime(350, audio.currentTime + duration); gain.gain.value = .14
    source.connect(filter); filter.connect(gain); gain.connect(audio.destination); source.start(); source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
  }
  private explosionSound() {
    if (this.muted || !this.audio || this.audio.state !== 'running') return
    const audio = this.audio, osc = audio.createOscillator(), gain = audio.createGain(); osc.frequency.setValueAtTime(125, audio.currentTime); osc.frequency.exponentialRampToValueAtTime(28, audio.currentTime + .4); gain.gain.setValueAtTime(.25, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .5); osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(audio.currentTime + .55); osc.onended = () => { osc.disconnect(); gain.disconnect() }
  }
}
