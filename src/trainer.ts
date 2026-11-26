import { TrainerAR } from './trainer-ar.ts'
import { FruitTracker } from './fruit-tracker.ts'
import { cameraFailure, trackingFailure } from './choir-camera-errors.ts'
import { coverPoint, type Point } from './fruit-game-core.ts'
import type { TrackingSample } from './fruit-vision.ts'
import { createPopSamples } from './pop-audio.ts'
import { ballAt, captureHp, maxHp, personContact, personCutout, readCaptures, teamSize, type Capture } from './trainer-core.ts'

const storageKey = 'notefolio.trainer.captures'
const fieldHelp = '포획구를 위로 쓸어 던지세요. 사람에게 닿는 순간 찰칵!'
type Action = 'fight' | 'heal' | 'run' | 'catch'
type Facing = 'user' | 'environment'
type Flight = { origin: Point; swipe: Point; at: number; progress: number; earlyHit?: { point: Point; progress: number }; landedAt?: number }

export class TrainerScene {
  private root: HTMLElement
  private video: HTMLVideoElement
  private portrait: HTMLCanvasElement
  private hurt: HTMLCanvasElement
  private impact: HTMLElement
  private maskCanvas = document.createElement('canvas')
  private personFrame = document.createElement('canvas')
  private trackingFrame = document.createElement('canvas')
  private ball: HTMLButtonElement
  private orb: HTMLElement
  private ghost: HTMLElement
  private inventory: HTMLDialogElement
  private captureResult: HTMLDialogElement
  private ar: TrainerAR
  private active = false
  private token = 0
  private stream?: MediaStream
  private facing: Facing = 'user'
  private switching = false
  private tracker?: FruitTracker
  private audio?: AudioContext
  private shutter?: AudioBuffer
  private frame = 0
  private busy = false
  private lastSample = -Infinity
  private videoTime = -1
  private person?: { mask: NonNullable<TrackingSample['mask']>; at: number }
  private pointer?: { id: number; start: Point }
  private handStart?: { point: Point; time: number }
  private flight?: Flight
  private mode: 'off' | 'field' | 'battle' = 'off'
  private turnReady = false
  private playerHp = maxHp
  private foeHp = maxHp
  private captures: Capture[] = []
  private opponent = '인간1'

  constructor(root: HTMLElement) {
    this.root = root
    this.video = this.get('video')
    this.portrait = this.get('.trainer-person')
    this.hurt = this.get('.trainer-hurt')
    this.impact = this.get('.trainer-impact')
    this.ball = this.get('.trainer-throw')
    this.orb = this.get('.trainer-throw .trainer-orb')
    this.ghost = this.get('.trainer-tip')
    this.inventory = this.get('.trainer-inventory')
    this.captureResult = this.get('.trainer-capture-result')
    this.ar = new TrainerAR(this.get('.trainer-ar'))
    try { this.captures = readCaptures(localStorage.getItem(storageKey)) } catch { /* Storage may be unavailable. */ }
    this.updateInventory()
    this.get('.trainer-start').addEventListener('click', () => { void this.start() })
    this.get('.trainer-stop').addEventListener('click', () => this.stop())
    this.get('.trainer-flip').addEventListener('click', () => { void this.flipCamera() })
    this.get('.trainer-boxes').addEventListener('click', () => {
      this.pointer = undefined
      this.disarmHand()
      this.updateInventory()
      this.inventory.showModal()
    })
    this.get('.trainer-return').addEventListener('click', () => {
      this.field()
      this.ball.focus({ preventScroll: true })
    })
    this.captureResult.addEventListener('close', () => {
      if (this.captureResult.open) return
      this.get<HTMLCanvasElement>('.trainer-capture-display canvas').width = 1
      if (this.mode !== 'battle') return
      this.field()
      this.ball.focus({ preventScroll: true })
    })
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-trainer-action]')) {
      button.addEventListener('click', () => { void this.turn(button.dataset.trainerAction as Action) })
    }
    this.ball.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || this.flight) return
      this.pointer = { id: event.pointerId, start: { x: event.clientX, y: event.clientY } }
      this.ball.setPointerCapture(event.pointerId)
    })
    this.ball.addEventListener('pointerup', event => {
      const pointer = this.pointer
      if (pointer?.id !== event.pointerId) return
      this.pointer = undefined
      this.throwBall({ x: event.clientX - pointer.start.x, y: event.clientY - pointer.start.y })
    })
    this.ball.addEventListener('lostpointercapture', () => { this.pointer = undefined })
    this.ball.addEventListener('click', event => {
      if (event.detail === 0) this.throwBall({ x: 0, y: -this.root.clientHeight * .24 })
    })
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.stream) this.stop()
    })
  }

  private get<T extends HTMLElement>(selector: string) { return this.root.querySelector<T>(selector)! }
  setActive(active: boolean) {
    this.active = active
    if (!active) this.stop()
  }

  private async start() {
    const button = this.get<HTMLButtonElement>('.trainer-start')
    const errorText = this.get('.trainer-error')
    if (!this.active || button.disabled || this.stream) return
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      errorText.textContent = '카메라는 localhost 또는 HTTPS에서 켤 수 있어요.'
      return
    }
    const token = ++this.token
    button.disabled = true
    this.unlockShutter()
    errorText.textContent = '카메라 사용을 허용해 주세요.'
    let phase: 'camera' | 'playback' | 'tracking' = 'camera'
    try {
      const stream = await this.requestCamera(this.facing)
      phase = 'playback'
      if (!await this.attachCamera(stream, this.facing, token)) return
      phase = 'tracking'
      errorText.textContent = '손과 사람 윤곽을 준비하고 있어요.'
      const tracker = new FruitTracker('snow')
      this.tracker = tracker
      await tracker.init(new URL(`${import.meta.env.BASE_URL}mediapipe`, location.href).href)
      if (token !== this.token) return
      this.get('.trainer-entry').hidden = true
      this.get('.trainer-stop').hidden = false
      this.get('.trainer-flip').hidden = false
      this.field()
      this.frame = requestAnimationFrame(this.tick)
    } catch (error) {
      if (token !== this.token) return
      this.stop()
      errorText.textContent = phase === 'tracking' ? trackingFailure(error) : cameraFailure(error, phase === 'playback')
    }
  }

  private requestCamera(facing: Facing, exact = false) {
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: exact ? { exact: facing } : { ideal: facing }, width: { ideal: 960 }, height: { ideal: 720 } },
      audio: false,
    })
  }

  private async attachCamera(stream: MediaStream, facing: Facing, token: number) {
    if (token !== this.token) { stream.getTracks().forEach(track => track.stop()); return false }
    const track = stream.getVideoTracks()[0]
    this.stream = stream
    track?.addEventListener('ended', () => {
      if (this.stream !== stream) return
      this.stop()
      this.get('.trainer-error').textContent = '카메라 연결이 끝났어요. 다시 켜 주세요.'
    }, { once: true })
    const cameraFacing = track?.getSettings().facingMode
    this.facing = cameraFacing === 'user' || cameraFacing === 'environment' ? cameraFacing : facing
    this.root.dataset.facing = this.facing
    this.get('.trainer-flip').textContent = this.facing === 'user' ? '후면 카메라로 전환' : '전면 카메라로 전환'
    this.video.srcObject = stream
    await this.video.play()
    this.videoTime = -1
    return token === this.token
  }

  private releaseCamera() {
    const stream = this.stream
    this.stream = undefined
    stream?.getTracks().forEach(track => track.stop())
    this.video.pause()
    this.video.srcObject = null
  }

  private async flipCamera() {
    if (!this.stream || this.switching) return
    const token = this.token, previous = this.facing, next = previous === 'user' ? 'environment' : 'user'
    const button = this.get<HTMLButtonElement>('.trainer-flip')
    const status = this.get('.trainer-camera-status')
    this.switching = button.disabled = true
    status.textContent = '카메라 전환 중…'
    this.finishFlight()
    this.person = undefined
    this.releaseCamera()
    try {
      if (!await this.attachCamera(await this.requestCamera(next, true), next, token)) return
      status.textContent = this.facing === next ? '' : '다른 카메라를 찾지 못했어요.'
    } catch {
      if (token !== this.token) return
      this.releaseCamera()
      try {
        if (await this.attachCamera(await this.requestCamera(previous), previous, token)) status.textContent = '전환할 카메라를 열지 못했어요.'
      } catch {
        if (token !== this.token) return
        this.stop()
        this.get('.trainer-error').textContent = '카메라를 다시 열지 못했어요.'
      }
    } finally {
      if (token === this.token) this.switching = button.disabled = false
    }
  }

  private stop() {
    this.token++
    cancelAnimationFrame(this.frame)
    this.tracker?.close()
    this.tracker = undefined
    this.releaseCamera()
    this.switching = false
    this.get<HTMLButtonElement>('.trainer-flip').disabled = false
    this.get('.trainer-camera-status').textContent = ''
    this.person = undefined
    this.busy = false
    this.videoTime = -1
    this.lastSample = -Infinity
    this.mode = 'off'
    this.finishFlight()
    this.portrait.width = this.hurt.width = this.personFrame.width = this.trackingFrame.width = 1
    this.captureResult.close()
    this.inventory.close()
    this.ar.close()
    delete this.root.dataset.motion
    this.get<HTMLButtonElement>('.trainer-start').disabled = false
    this.get('.trainer-error').textContent = ''
    this.get('.trainer-entry').hidden = false
    for (const selector of ['.trainer-stage', '.trainer-field', '.trainer-stop', '.trainer-flip']) this.get(selector).hidden = true
  }

  private field() {
    this.mode = 'field'
    this.turnReady = false
    delete this.root.dataset.motion
    this.finishFlight()
    this.get('.trainer-stage').hidden = true
    this.get('.trainer-field').hidden = false
    this.get('.trainer-field-note').textContent = fieldHelp
  }

  private ballCenter(): Point {
    const box = this.ball.getBoundingClientRect(), field = this.root.getBoundingClientRect()
    return { x: box.left + box.width / 2 - field.left, y: box.top + box.height / 2 - field.top }
  }

  private throwBall(swipe: Point) {
    if (this.mode !== 'field' || this.switching || this.flight || this.inventory.open || swipe.y > -Math.max(16, this.orb.offsetWidth * .25)) return
    this.flight = { origin: this.ballCenter(), swipe, at: performance.now(), progress: 0 }
    this.ball.classList.add('in-flight')
    this.disarmHand()
    this.ghost.hidden = true
    this.get('.trainer-field-note').textContent = '포획구를 던졌다!'
  }

  private finishFlight() {
    this.flight = this.pointer = undefined
    this.disarmHand()
    this.ball.classList.remove('in-flight')
    this.ball.style.transform = ''
    this.orb.style.rotate = ''
    this.ghost.hidden = true
    this.impact.hidden = true
  }

  private updateFlight(now: number) {
    const flight = this.flight
    if (!flight) return
    if (flight.landedAt !== undefined) {
      if (now - flight.landedAt >= 460) {
        this.finishFlight()
        void this.encounter()
      }
      return
    }
    const width = this.root.clientWidth, height = this.root.clientHeight
    const progress = Math.min(1, Math.max(0, (now - flight.at) / 670)) ** 1.8
    const point = ballAt(flight.origin, flight.swipe, height, progress)
    this.moveBall(flight.origin, point, progress)
    const radius = this.orb.offsetWidth / 2
    const mask = this.person && now - this.person.at <= 750 ? this.person.mask : undefined
    const start = Math.max(flight.earlyHit ? .15 : .035, flight.progress)
    if (mask && progress >= start) {
      const steps = Math.max(1, Math.ceil((progress - start) / .008))
      for (let i = 0; i <= steps; i++) {
        const step = start + (progress - start) * i / steps
        const center = ballAt(flight.origin, flight.swipe, height, step)
        const hit = personContact(mask, center, this.personFrame.width, this.personFrame.height, width, height, radius * (1 - .42 * step), this.facing === 'user')
        if (hit === -1 || (step < .15 && flight.earlyHit) || !this.drawOpponent(mask, hit)) continue
        if (step >= .15) { this.landBall(flight, center, step, now); return }
        flight.earlyHit = { point: center, progress: step }
      }
    }
    if (progress >= .15 && flight.earlyHit) {
      this.landBall(flight, flight.earlyHit.point, flight.earlyHit.progress, now)
      return
    }
    if (mask) flight.progress = progress
    const finished = progress >= 1 || point.x < -radius || point.x > width + radius || point.y < -radius
    if (finished && !mask && now - flight.at < 1100) return
    if (finished) {
      this.finishFlight()
      this.get('.trainer-field-note').textContent = mask?.data.includes(1)
        ? '빗나갔어요. 사람을 향해 다시 던져보세요.'
        : '카메라에 사람이 보이면 다시 던져보세요.'
    }
  }

  private moveBall(origin: Point, point: Point, progress: number) {
    this.ball.style.transform = `translate(${point.x - origin.x}px, ${point.y - origin.y}px) scale(${1 - .42 * progress})`
    this.orb.style.rotate = `${progress * 620}deg`
  }

  private landBall(flight: Flight, center: Point, progress: number, now: number) {
    flight.landedAt = now
    this.moveBall(flight.origin, center, progress)
    this.impact.style.left = `${center.x}px`
    this.impact.style.top = `${center.y}px`
    this.impact.hidden = false
    this.playShutter()
    this.get('.trainer-field-note').textContent = '찰칵! 맞았다!'
  }

  private unlockShutter() {
    try {
      const audio = this.audio ??= new AudioContext()
      if (audio.state !== 'running') void audio.resume().catch(() => {})
      if (!this.shutter) {
        const samples = createPopSamples(2, audio.sampleRate)
        this.shutter = audio.createBuffer(1, samples.length, audio.sampleRate)
        this.shutter.getChannelData(0).set(samples)
      }
    } catch { /* Capture works without sound if audio is unavailable. */ }
  }

  private playShutter() {
    if (!this.audio || !this.shutter || this.audio.state !== 'running') return
    const sound = this.audio.createBufferSource()
    sound.buffer = this.shutter
    sound.connect(this.audio.destination)
    sound.onended = () => sound.disconnect()
    sound.start()
  }

  private disarmHand() {
    this.handStart = undefined
    this.ball.classList.remove('is-armed')
  }

  private handSwipe(sample: TrackingSample, now: number) {
    if (this.mode !== 'field' || this.flight || this.pointer || this.inventory.open || !sample.landmarks[8]) {
      if (this.handStart && now - this.handStart.time > 1000) this.disarmHand()
      this.ghost.hidden = true
      return
    }
    const tip = sample.landmarks[8]
    const point = coverPoint(this.facing === 'user' ? tip : { x: 1 - tip.x, y: tip.y }, this.video.videoWidth, this.video.videoHeight, this.root.clientWidth, this.root.clientHeight)
    this.ghost.hidden = false
    this.ghost.style.left = `${point.x}px`
    this.ghost.style.top = `${point.y}px`
    if (this.handStart && now - this.handStart.time > 1000) this.disarmHand()
    if (this.handStart) {
      this.throwBall({ x: point.x - this.handStart.point.x, y: point.y - this.handStart.point.y })
    } else {
      const origin = this.ballCenter()
      if (Math.hypot(point.x - origin.x, point.y - origin.y) <= this.ball.offsetWidth / 2) {
        this.handStart = { point, time: now }
        this.ball.classList.add('is-armed')
      }
    }
  }

  private async track(now: number) {
    const tracker = this.tracker, stream = this.stream
    if (this.mode !== 'field' || !tracker || !stream || this.switching || this.busy || now - this.lastSample < 70 || this.video.readyState < 2 || this.videoTime === this.video.currentTime) return
    this.busy = true
    this.lastSample = now
    this.videoTime = this.video.currentTime
    try {
      const frame = this.trackingFrame
      frame.width = Math.min(640, this.video.videoWidth)
      frame.height = Math.round(frame.width * this.video.videoHeight / this.video.videoWidth)
      frame.getContext('2d')!.drawImage(this.video, 0, 0, frame.width, frame.height)
      const sample = await tracker.sample(this.video, now, true)
      if (tracker !== this.tracker || stream !== this.stream) return
      if (sample.mask) {
        this.person = { mask: sample.mask, at: performance.now() }
        this.trackingFrame = this.personFrame
        this.personFrame = frame
      }
      this.handSwipe(sample, now)
    } catch {
      if (tracker !== this.tracker || stream !== this.stream) return
      this.stop()
      this.get('.trainer-error').textContent = '사람 인식이 중단됐어요. 카메라를 다시 켜 주세요.'
    } finally {
      if (tracker === this.tracker) this.busy = false
    }
  }

  private tick = (now: number) => {
    if (!this.active || this.mode === 'off') return
    void this.track(now)
    if (this.flight) this.updateFlight(now)
    if (this.tracker) this.frame = requestAnimationFrame(this.tick)
  }

  private drawOpponent(mask: NonNullable<TrackingSample['mask']>, hit: number) {
    const cutout = personCutout(mask, hit)
    if (!cutout) return false
    const { x, y, width, height, pixels } = cutout
    const frame = this.personFrame, canvas = this.portrait
    const scaleX = frame.width / mask.width, scaleY = frame.height / mask.height
    canvas.width = this.hurt.width = Math.max(1, Math.round(width * scaleX))
    canvas.height = this.hurt.height = Math.max(1, Math.round(height * scaleY))
    const maskCanvas = this.maskCanvas
    maskCanvas.width = width
    maskCanvas.height = height
    const maskCtx = maskCanvas.getContext('2d')!
    const image = maskCtx.createImageData(width, height)
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        image.data[(row * width + col) * 4 + 3] = pixels[(y + row) * mask.width + x + col] ? 255 : 0
      }
    }
    maskCtx.putImageData(image, 0, 0)
    const ctx = canvas.getContext('2d')!
    if (this.facing === 'user') ctx.setTransform(-1, 0, 0, 1, canvas.width, 0)
    ctx.drawImage(frame, x * scaleX, y * scaleY, width * scaleX, height * scaleY, 0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height)
    const tint = this.hurt.getContext('2d')!
    tint.drawImage(canvas, 0, 0)
    tint.globalCompositeOperation = 'source-in'
    tint.fillStyle = '#fa2442'
    tint.fillRect(0, 0, canvas.width, canvas.height)
    return true
  }

  private hp() {
    this.get<HTMLMeterElement>('.trainer-player-hp').value = this.playerHp
    this.get<HTMLMeterElement>('.trainer-enemy-hp').value = this.foeHp
    this.get('.trainer-player-number').textContent = `HP ${this.playerHp} / ${maxHp}`
    this.get('.trainer-enemy-number').textContent = `HP ${this.foeHp} / ${maxHp}`
  }

  private message(text: string) { this.get('.trainer-message').textContent = text }

  private async beat(text: string, motion: string, ms: number) {
    const token = this.token
    this.message(text)
    this.root.dataset.motion = motion
    await new Promise(resolve => setTimeout(resolve, ms))
    if (token !== this.token) return false
    delete this.root.dataset.motion
    return true
  }

  private async encounter() {
    this.mode = 'battle'
    this.opponent = `인간${this.captures.length + 1}`
    this.playerHp = this.foeHp = maxHp
    this.get('.trainer-enemy-name').textContent = this.opponent
    this.get('.trainer-field').hidden = true
    this.get('.trainer-stage').hidden = false
    this.get('.trainer-return').hidden = true
    this.get('.trainer-actions').hidden = true
    this.hp()
    if (await this.beat(`${this.opponent}이 배틀을 신청했다.`, 'enter', 1150)) this.prompt()
  }

  private prompt() {
    this.turnReady = true
    this.get('[data-trainer-action="catch"]').hidden = this.foeHp > captureHp
    this.get('.trainer-actions').hidden = false
    this.message(this.foeHp <= captureHp ? '나는 무엇을 할까? 상대가 약해졌다. 포획할 수 있다!' : '나는 무엇을 할까?')
    if (!this.inventory.open) this.get('[data-trainer-action="fight"]').focus({ preventScroll: true })
  }

  private result(text: string) {
    this.message(text)
    const button = this.get('.trainer-return')
    button.hidden = false
    if (!this.inventory.open) button.focus({ preventScroll: true })
  }

  private async captureOpponent() {
    if (!await this.beat(`${this.opponent}에게 포획구를 던졌다!`, 'capture', 1500)) return
    const picture = document.createElement('canvas')
    const scale = Math.min(1, 360 / Math.max(this.portrait.width, this.portrait.height))
    picture.width = Math.max(1, Math.round(this.portrait.width * scale))
    picture.height = Math.max(1, Math.round(this.portrait.height * scale))
    picture.getContext('2d')!.drawImage(this.portrait, 0, 0, picture.width, picture.height)
    const photo = picture.toDataURL('image/webp', .85)
    this.captures.push({ name: this.opponent, date: new Date().toISOString(), photo })
    let saved = true
    try { localStorage.setItem(storageKey, JSON.stringify(this.captures)) } catch { saved = false }
    this.updateInventory()
    this.root.dataset.motion = 'captured'

    const caption = `${this.opponent}을 잡았다!`
    const destination = this.captures.length <= teamSize ? '팀' : '보관함'
    this.message(caption)
    this.get('#trainer-capture-message').textContent = caption
    this.get('#trainer-capture-note').textContent = `${destination}에 추가했어요.${saved ? '' : ' 이번 실행 동안만 보관돼요.'}`
    const portrait = this.get<HTMLCanvasElement>('.trainer-capture-display canvas')
    portrait.width = this.portrait.width
    portrait.height = this.portrait.height
    portrait.getContext('2d')!.drawImage(this.portrait, 0, 0)
    if (this.inventory.open) this.inventory.close()
    this.captureResult.showModal()
  }

  private async turn(action: Action) {
    if (this.mode !== 'battle' || !this.turnReady || (action === 'catch' && this.foeHp > captureHp)) return
    this.turnReady = false
    this.get('.trainer-actions').hidden = true

    if (action === 'run') {
      if (await this.beat('배틀에서 도망쳤다!', 'run', 650)) this.result('무사히 도망쳤다.')
      return
    }
    if (action === 'catch') {
      await this.captureOpponent()
      return
    }
    if (action === 'fight') {
      if (!await this.beat('나는 빛 파동을 사용했다!', 'strike', 360)) return
      this.foeHp = Math.max(0, this.foeHp - 27)
      this.hp()
      if (!await this.beat(`${this.opponent}에게 맞았다!`, 'foe-hurt', 300)) return
      if (this.foeHp === 0) { await this.captureOpponent(); return }
    } else {
      const healed = Math.min(35, maxHp - this.playerHp)
      this.playerHp += healed
      this.hp()
      if (!await this.beat(healed ? `HP를 ${healed} 회복했다!` : '이미 HP가 가득하다.', healed ? 'heal' : '', 700)) return
    }
    if (!await this.beat(`${this.opponent}이 반격한다!`, 'counter', 420)) return
    this.playerHp = Math.max(0, this.playerHp - 18)
    this.hp()
    if (!await this.beat('반격을 맞았다!', 'hurt', 440)) return
    if (this.playerHp === 0) { this.result('힘이 다했다. 배틀이 끝났다.'); return }
    this.prompt()
  }

  private updateInventory() {
    this.get('.trainer-boxes span').textContent = String(this.captures.length)
    this.get('.trainer-team-count').textContent = `${Math.min(this.captures.length, teamSize)} / ${teamSize}`
    for (const [selector, entries] of [['.trainer-team', this.captures.slice(0, teamSize)], ['.trainer-box', this.captures.slice(teamSize)]] as const) {
      const list = this.get(selector)
      list.replaceChildren()
      if (!entries.length) {
        const empty = document.createElement('li')
        empty.className = 'trainer-empty'
        empty.textContent = '아직 비어 있어요.'
        list.append(empty)
      }
      for (const entry of entries) {
        const item = document.createElement('li')
        const name = document.createElement('strong'), date = document.createElement('small')
        name.textContent = entry.name
        date.textContent = new Date(entry.date).toLocaleDateString('ko-KR')
        const photo = entry.photo
        if (photo) {
          const image = document.createElement('img')
          image.src = photo
          image.alt = `${entry.name}의 포획 사진`
          const place = document.createElement('button')
          place.type = 'button'
          place.textContent = '꺼내기'
          place.setAttribute('aria-label', `${entry.name} 꺼내기`)
          place.addEventListener('click', () => {
            this.stop()
            void this.ar.show(entry.name, photo)
          })
          item.append(image, name, date, place)
        } else {
          const missing = document.createElement('small')
          missing.textContent = '포획 사진 없음'
          item.append(name, date, missing)
        }
        list.append(item)
      }
    }
  }
}
