import { ChoirStage } from './choir-stage.ts'
import { ChoirMusic } from './choir-music.ts'
import { Conducting, ConductingSequence, choirRating, choirVideo, conductingMotions, type Palm } from './choir-core.ts'
import { ChoirGestures, readChoirHand, isCircularPath } from './choir-gestures.ts'
import { choirGuide } from './choir-markup.ts'
import { choirInstruction } from './choir-instructions.ts'
import { ChoirScoldPrompt } from './choir-scold-prompt.ts'
import { cameraFailure, trackingFailure, requestChoirCamera } from './choir-camera-errors.ts'
import { coverPoint } from './fruit-game-core.ts'
import { FruitTracker } from './fruit-tracker.ts'

export class ChoirScene {
  private root: HTMLElement
  private stage?: ChoirStage
  private music?: ChoirMusic
  private musicToken = 0
  private controls = new Conducting()
  private tracker?: FruitTracker
  private stream?: MediaStream
  private trackingReady = false
  private video: HTMLVideoElement
  private active = false
  private frame = 0
  private last = 0
  private generation = 0
  private loading = false
  private busy = false
  private lastInference = 0
  private videoTime = -1
  private started = false
  private gestures = new ChoirGestures()
  private scoldPrompt = new ChoirScoldPrompt()
  private sequence = new ConductingSequence()
  private get motion() { return this.sequence.motion }
  private path: Palm[] = []
  private pointing = false
  private guidePose = ''
  private guideHands: HTMLElement[]
  private cue: HTMLElement
  private cameraNotice = ''
  private musicNotice = ''
  private helpPose = ''
  private cameraButton: HTMLButtonElement
  private startButton: HTMLButtonElement
  private pauseButton: HTMLButtonElement
  private qualityLabel: HTMLElement
  constructor(root: HTMLElement) {
    this.root = root; this.video = root.querySelector('video')!; this.guideHands = [...root.querySelectorAll<HTMLElement>('.choir-guide-hands > div')]; this.cue = root.querySelector('.choir-cue')!; this.cameraButton = root.querySelector('.choir-camera-toggle')!; this.startButton = root.querySelector('.choir-start')!; this.pauseButton = root.querySelector('.choir-pause')!; this.qualityLabel = root.querySelector('.choir-quality strong')!
    this.cameraButton.addEventListener('click', () => { if (this.stream || this.loading) this.stopCamera(); else void this.startCamera() })
    this.startButton.addEventListener('click', () => {
      if (!this.music?.ready || !this.stream || !this.trackingReady) return
      this.started = true; this.gestures.reset(); this.scoldPrompt.reset(); this.sequence.reset(); this.path = []; this.controls.reset(performance.now()); this.music.start(); this.updateInstruction()
    })
    this.pauseButton.addEventListener('click', () => { this.gestures.paused = !this.gestures.paused; this.gestures.resumeAt = 0; if (this.gestures.paused) this.music?.setPlaying(false); else { this.controls.recalibrate(performance.now()); this.music?.allowPlayback() }; this.updateInstruction() })
    root.querySelector('.choir-allow')!.addEventListener('click', () => { this.music?.allowPlayback(); root.querySelector<HTMLElement>('.choir-allow')!.hidden = true })
    root.querySelector('.choir-tracking-retry')!.addEventListener('click', () => { if (!this.loading) void this.prepareTracking(this.generation) })
    root.querySelector('.choir-reload')!.addEventListener('click', () => { void this.prepareMusic() })
    new ResizeObserver(() => this.resize()).observe(root.querySelector('.choir-viewport')!)
    document.addEventListener('visibilitychange', () => {
      if (!this.active) return
      if (document.hidden) { this.music?.setPlaying(false); this.gestures.paused = this.started; this.gestures.resumeAt = 0; cancelAnimationFrame(this.frame); this.frame = 0 }
      else { this.last = 0; this.wake() }
    })
  }
  setActive(active: boolean) {
    if (this.active === active) return
    this.active = active
    if (!active) { cancelAnimationFrame(this.frame); this.frame = 0; this.stopCamera(); this.musicToken++; this.music?.close(); this.music = undefined; return }
    if (!this.stage) { try { this.stage = new ChoirStage(this.root.querySelector('.choir-viewport')!) } catch { this.setCameraNotice('3D 무대를 열 수 없어요. WebGL을 지원하는 브라우저에서 다시 시도해 주세요.'); return } }
    this.resize(); void this.prepareMusic(); this.last = 0; this.wake()
  }
  private setText(element: HTMLElement, text: string) { if (element.textContent !== text) element.textContent = text }
  private resize() { if (!this.active || !this.stage) return; const rect = this.root.querySelector('.choir-viewport')!.getBoundingClientRect(); this.stage.resize(rect.width, rect.height) }
  private setCameraNotice(message: string) { this.cameraNotice = message; this.updateInstruction() }
  private setMusicNotice(message: string) { this.musicNotice = message; this.updateInstruction() }
  private async prepareMusic() {
    const token = ++this.musicToken; this.music?.close(); this.started = false; this.gestures.reset(); this.scoldPrompt.reset()
    const music = new ChoirMusic(); this.music = music
    this.root.querySelector<HTMLElement>('.choir-reload')!.hidden = true; this.root.querySelector<HTMLElement>('.choir-allow')!.hidden = true
    this.setMusicNotice('합창곡을 준비하고 있어요…')
    try {
      await music.init(message => {
        if (token !== this.musicToken) return
        this.setMusicNotice(message)
        this.root.querySelector<HTMLElement>('.choir-reload')!.hidden = music.ready
        this.root.querySelector<HTMLElement>('.choir-allow')!.hidden = !music.ready
      }, () => {
        if (token === this.musicToken && music.playing) { this.setMusicNotice(''); this.root.querySelector<HTMLElement>('.choir-allow')!.hidden = true }
      })
      if (token === this.musicToken && this.active) this.setMusicNotice('')
    } catch (error) { if (token === this.musicToken && this.active) { this.setMusicNotice(error instanceof Error ? error.message : '음원을 불러오지 못했어요.'); this.root.querySelector<HTMLElement>('.choir-reload')!.hidden = false } }
  }
  private async startCamera() {
    if (!this.active || this.loading || this.stream) return
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { this.setCameraNotice('브라우저가 안전한 연결로 인식하지 못했어요. 인증서를 신뢰 등록한 뒤 HTTPS 주소로 다시 접속해 주세요.'); return }
    const token = ++this.generation; this.loading = true; this.cameraButton.disabled = true; this.setCameraNotice('카메라 사용을 허용해 주세요.')
    let playback = false
    try {
      const stream = await requestChoirCamera(navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices))
      if (token !== this.generation || !this.active) { stream.getTracks().forEach(track => track.stop()); return }
      this.stream = stream; this.video.srcObject = stream; this.video.muted = true; this.video.playsInline = true; playback = true
      await this.video.play()
      if (token !== this.generation || !this.active) return
      this.setText(this.cameraButton, '카메라 끄기'); this.cameraButton.disabled = false
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (token === this.generation) { this.stopCamera(); this.setCameraNotice('카메라 연결이 끝났어요. 다시 켜 주세요.') } }, { once: true })
      await this.prepareTracking(token)
    } catch (error) {
      if (token !== this.generation) return
      console.error('합창단 카메라 실행 실패', error)
      this.stopCamera(); this.setCameraNotice(cameraFailure(error, playback))
    } finally { if (token === this.generation) { this.loading = false; this.cameraButton.disabled = false } }
  }
  private async prepareTracking(token: number) {
    if (!this.stream || !this.active || token !== this.generation || this.trackingReady) return
    this.loading = true; this.root.querySelector<HTMLElement>('.choir-tracking-retry')!.hidden = true; this.setCameraNotice('카메라가 켜졌어요. 양손 추적을 준비하고 있어요…')
    const tracker = new FruitTracker('choir'); this.tracker = tracker
    try {
      await tracker.init(new URL(`${import.meta.env?.BASE_URL ?? '/'}mediapipe`, location.href).href)
      if (token !== this.generation || !this.active) { tracker.close(); return }
      this.trackingReady = true; this.controls.reset(performance.now()); this.path = []; this.busy = false; this.videoTime = -1; this.setCameraNotice('')
    } catch (error) {
      if (token !== this.generation) { tracker.close(); return }
      console.error('합창단 손 추적 준비 실패', error)
      this.stopTracking(); this.setCameraNotice(trackingFailure(error)); this.root.querySelector<HTMLElement>('.choir-tracking-retry')!.hidden = false
    } finally { if (token === this.generation) { this.loading = false; this.cameraButton.disabled = false } }
  }
  private stopTracking() {
    this.tracker?.close(); this.tracker = undefined; this.trackingReady = this.busy = this.started = false
    this.gestures.reset(); this.scoldPrompt.reset(); this.pointing = false; this.music?.setPlaying(false); this.controls.reset(performance.now()); this.path = []
    this.root.querySelector<HTMLElement>('.choir-tracking-retry')!.hidden = true
  }
  private stopCamera() {
    this.generation++; this.stopTracking(); this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined; this.video.pause(); this.video.srcObject = null; this.loading = false; this.cameraButton.disabled = false; this.setText(this.cameraButton, '카메라 켜기'); this.setCameraNotice('')
  }
  private async sampleHands(now: number) {
    if (!this.tracker || this.busy || this.loading || this.video.readyState < 2 || this.video.currentTime === this.videoTime || now - this.lastInference < 50) return
    const token = this.generation; this.busy = true; this.lastInference = now; this.videoTime = this.video.currentTime
    try {
      const sample = await this.tracker.sample(this.video, now, false)
      if (token !== this.generation || !this.active || document.hidden) return
      const hands = (sample.hands ?? []).map((points, index) => ({ hand: readChoirHand(points), side: sample.handedness?.[index] }))
      const right = hands.find(value => value.side === 'Right')?.hand ?? hands.find(value => !value.side && value.hand && value.hand.palm.x >= .5)?.hand
      const left = hands.find(value => value.side === 'Left')?.hand ?? hands.find(value => !value.side && value.hand && value.hand.palm.x < .5)?.hand
      const timestamp = performance.now(), taps = this.gestures.taps
      let target = -1
      this.pointing = right?.pose === 'point'
      const pointer = this.root.querySelector<HTMLElement>('.choir-pointer')!
      pointer.hidden = !this.pointing
      if (right && this.pointing) {
        const rect = this.root.querySelector('.choir-viewport')!.getBoundingClientRect()
        const point = coverPoint({ x: 1 - right.tip.x, y: right.tip.y }, this.video.videoWidth || 960, this.video.videoHeight || 720, rect.width, rect.height)
        pointer.style.left = `${point.x}px`; pointer.style.top = `${point.y}px`
        target = this.stage?.memberAt(point.x, point.y) ?? -1
        if (this.scoldPrompt.active && target !== this.scoldPrompt.target) target = -1
      }
      this.gestures.hands(left, right, timestamp, this.started, target)
      if (this.gestures.taps > taps) { this.music?.tap(); const baton = this.root.querySelector<HTMLElement>('.choir-desk i')!; baton.animate?.([{ transform: 'rotate(25deg)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(25deg)' }], { duration: 160 }) }
      if (right) {
        this.path.push(right.palm); if (this.path.length > 20) this.path.shift()
        const metric = this.motion === 'sweep' ? { x: right.palm.y, y: right.palm.x } : right.palm
        const valid = right.pose === conductingMotions[this.motion].pose && (this.motion !== 'circle' || isCircularPath(this.path))
        this.controls.hands([metric, metric], timestamp, !!this.music?.playing && this.started && !this.pointing && !this.gestures.paused && !this.scoldPrompt.active, valid)
      } else this.path = []
    } catch (error) { if (token === this.generation) { console.error('합창단 손 추적 중단', error); this.stopTracking(); this.setCameraNotice(trackingFailure(error)); this.root.querySelector<HTMLElement>('.choir-tracking-retry')!.hidden = false } }
    finally { if (token === this.generation) this.busy = false }
  }
  private updateInstruction(now = performance.now()) {
    const music = this.music, remaining = this.gestures.resumeAt ? Math.max(0, Math.ceil((this.gestures.resumeAt - now) / 1000)) : 0
    const view = choirInstruction({
      cameraNotice: this.cameraNotice, musicNotice: this.musicNotice, cameraOn: !!this.stream, musicReady: !!music?.ready,
      started: this.started, ended: !!music?.ended, remaining, paused: this.gestures.paused, hasHand: this.controls.hasHands,
      singing: this.started && !this.gestures.paused && this.controls.hasHands && !!music?.playing,
      scolded: this.scoldPrompt.succeeded ? -1 : this.gestures.scolded, selected: this.gestures.selected, beats: this.controls.beats, matched: this.controls.matched, motion: this.motion, scoldTarget: this.scoldPrompt.target,
    })
    this.setText(this.cue, view.text); this.root.dataset.instruction = view.kind
    this.root.querySelector<HTMLElement>('.choir-music-actions')!.hidden = view.kind !== 'notice'
    const pointingGuide = view.kind === 'selected' || view.kind === 'scold-prompt'
    const showHand = view.kind === 'conducting' || pointingGuide, guidePose = pointingGuide ? 'point' : this.motion, guide = this.guideHands[0]
    this.root.querySelector<HTMLElement>('.choir-guide-hands')!.hidden = !showHand
    if (guide && guidePose !== this.guidePose) { guide.innerHTML = choirGuide(guidePose); this.guidePose = guidePose }
    if (guide && showHand) {
      const phase = this.controls.phase * Math.PI * 2
      guide.style.transform = view.kind === 'scold-prompt' && this.gestures.selected !== this.scoldPrompt.target ? 'none' : pointingGuide || this.motion === 'sweep' ? `translateX(${-Math.cos(phase) * 45}px)` : this.motion === 'vertical' ? `translateY(${-Math.cos(phase) * 30}px)` : `translate(${Math.sin(phase) * 35}px, ${-Math.cos(phase) * 30}px)`
    }
    this.root.querySelector<HTMLElement>('.choir-countdown')!.hidden = view.kind !== 'countdown'
    this.setText(this.root.querySelector('.choir-countdown strong')!, String(remaining))
    this.root.querySelector<HTMLElement>('.choir-desk')!.hidden = view.kind !== 'paused' || !this.gestures.paused
    const helpPose = this.gestures.paused || view.kind === 'scold-prompt' ? 'point' : this.motion
    if (helpPose !== this.helpPose) { this.root.querySelector<HTMLElement>('.choir-help-right .choir-help-icon')!.innerHTML = choirGuide(helpPose); this.helpPose = helpPose }
    this.setText(this.root.querySelector('.choir-help-action')!, this.gestures.paused ? '탁탁 재개' : view.kind === 'scold-prompt' ? '혼내기' : '지휘')
  }
  private wake() { if (this.active && !document.hidden && !this.frame) this.frame = requestAnimationFrame(this.tick) }
  private tick = (now: number) => {
    this.frame = 0; if (!this.active || document.hidden || !this.stage) return
    const dt = this.last ? Math.min(.05, (now - this.last) / 1000) : 0; this.last = now
    const music = this.music
    if (this.sequence.advance(dt, !!music?.playing && this.started && !this.gestures.paused && !this.scoldPrompt.active)) { this.controls.recalibrate(now); this.path = [] }
    const motion = conductingMotions[this.motion]
    const wasPaused = this.gestures.paused
    this.gestures.advance(now, dt)
    if (wasPaused && !this.gestures.paused) this.controls.recalibrate(now)
    music?.setRate(motion.rate); music?.setPitch(this.gestures.pitch)
    this.controls.targetBpm = 80 * (music?.rate ?? motion.rate)
    this.controls.advance(dt, now, !!music?.playing && this.started && !this.pointing && !this.gestures.paused && !this.scoldPrompt.active)
    if (this.stream) void this.sampleHands(now)
    const allowed = this.started && !!this.stream && this.trackingReady && this.controls.hasHands && !this.gestures.paused
    if (this.started) music?.setPlaying(allowed)
    const singing = allowed && !!music?.playing && !music.ended, rating = choirRating(this.controls.harmony), good = rating.key === 'nice' || rating.key === 'excellent'
    const promptChange = this.scoldPrompt.advance(dt, singing && !this.cameraNotice && !this.musicNotice, good, this.gestures.scolded, this.pointing || this.gestures.selected >= 0 || this.gestures.scolded >= 0)
    if (promptChange) { this.gestures.clearSelection(); this.path = []; this.controls.recalibrate(now) }
    this.stage.update(dt, now, this.controls.phase, singing, good, music?.position ?? 0, this.gestures.scolded, this.scoldPrompt.active ? this.scoldPrompt.target : this.gestures.selected)
    this.startButton.disabled = !this.stream || this.loading || !this.trackingReady || !music?.ready; this.pauseButton.disabled = !this.started || !!music?.ended
    this.setText(this.startButton, this.started ? '처음부터 다시 시작 ↺' : '합창 시작')
    this.setText(this.pauseButton, this.gestures.paused ? '이어서 지휘 ▶' : '잠깐 쉬기')
    this.root.querySelector<HTMLElement>('.choir-quality')!.hidden = !this.started
    this.setText(this.qualityLabel, rating.label); this.root.dataset.quality = rating.key; this.root.dataset.harmony = good ? 'good' : 'shaky'
    const pitch = this.gestures.pitch
    this.root.querySelector<HTMLElement>('.choir-pitch')!.setAttribute('aria-valuenow', pitch.toFixed(1))
    this.root.querySelector<HTMLElement>('.choir-pitch i')!.style.bottom = `${50 + pitch / 6 * 47}%`
    const time = Math.min(choirVideo.end, Math.max(choirVideo.start, music?.position ?? choirVideo.start)), display = `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`
    this.setText(this.root.querySelector('.choir-progress')!, `${display} / 1:52`)
    this.updateInstruction(now)
    this.wake()
  }
}
