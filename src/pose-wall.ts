import type { PoseLandmarker } from '@mediapipe/tasks-vision'
import { cameraFailure, requestChoirCamera } from './choir-camera-errors.ts'
import { PoseWallRound, allowedMisses, type BodyPose } from './pose-wall-core.ts'
import { PoseWallCoach } from './pose-wall-coach.ts'
import type { WallOpening } from './pose-wall-opening.ts'
import type { PlayerCount } from './pose-wall-presets.ts'
import { PoseWallStage } from './pose-wall-stage.ts'
import { createPoseWallModel, readBodies } from './pose-wall-vision.ts'

type CameraFacing = 'user' | 'environment'

export class PoseWallScene {
  private root: HTMLElement
  private video: HTMLVideoElement
  private entry: HTMLElement
  private play: HTMLElement
  private end: HTMLElement
  private startButtons: HTMLButtonElement[]
  private flipButton: HTMLButtonElement
  private person: HTMLCanvasElement
  private coachPanel: HTMLElement
  private coachLabels: HTMLSpanElement[]
  private floor: HTMLCanvasElement
  private stamp = document.createElement('canvas')
  private input = document.createElement('canvas')
  private inputContext = this.input.getContext('2d')!
  private round = new PoseWallRound(1)
  private stage?: PoseWallStage
  private coach?: PoseWallCoach
  private model?: PoseLandmarker
  private stream?: MediaStream
  private facing: CameraFacing = 'user'
  private switchingCamera = false
  private frame = 0
  private generation = 0
  private sampled = -Infinity
  private videoTime = -1
  private bodies: BodyPose[] = []
  private floorOpening?: WallOpening
  private maskSource?: BodyPose[]

  constructor(root: HTMLElement) {
    this.root = root
    this.video = this.get('.pose-wall-camera')
    this.entry = this.get('.pose-wall-entry')
    this.play = this.get('.pose-wall-play')
    this.end = this.get('.pose-wall-over')
    this.startButtons = [...root.querySelectorAll<HTMLButtonElement>('.pose-wall-start')]
    this.flipButton = this.get('.pose-wall-flip')
    this.person = this.get('.pose-wall-person')
    this.floor = this.get('.pose-wall-floor')
    this.coachPanel = this.get('.pose-wall-coach')
    this.coachLabels = [...this.coachPanel.querySelectorAll('span')]
    this.startButtons.forEach(button => button.addEventListener('click', () => void this.start(button.dataset.players === '2' ? 2 : 1)))
    this.flipButton.addEventListener('click', () => void this.flipCamera())
    this.get('.pose-wall-stop').addEventListener('click', () => this.stop(true))
    this.get('.pose-wall-restart').addEventListener('click', () => {
      this.round = new PoseWallRound(this.round.players)
      this.end.hidden = true
      this.get<HTMLButtonElement>('.pose-wall-stop').focus({ preventScroll: true })
    })
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.startButtons[0].disabled) this.stop() })
  }

  setActive(active: boolean) { if (!active) this.stop() }

  private get<T extends HTMLElement = HTMLElement>(selector: string) {
    return this.root.querySelector<T>(selector)!
  }

  private async start(players: PlayerCount) {
    if (this.startButtons[0].disabled) return
    const generation = ++this.generation
    const error = this.get('.pose-wall-error')
    this.startButtons.forEach(button => { button.disabled = true })
    this.round = new PoseWallRound(players)
    error.textContent = '카메라를 여는 중이에요.'
    let stage: 'camera' | 'playback' | 'graphics' | 'tracking' = 'camera'
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('Camera requires HTTPS', 'SecurityError')
      const stream = await this.requestCamera('user')
      stage = 'playback'
      if (!await this.attachCamera(stream, 'user', generation)) return
      this.root.dataset.camera = ''
      stage = 'graphics'
      error.textContent = '3D 안내 모델을 준비하고 있어요.'
      const guide = await PoseWallCoach.load()
      if (generation !== this.generation) { guide.geometry.dispose(); return }
      this.stage = new PoseWallStage(this.get<HTMLCanvasElement>('.pose-wall-3d'), this.get<HTMLCanvasElement>('.pose-wall-contour'))
      this.coach = new PoseWallCoach(this.get<HTMLCanvasElement>('.pose-wall-coach canvas'), guide)
      stage = 'tracking'
      error.textContent = '전신 인식을 준비하고 있어요.'
      const base = new URL(`${import.meta.env.BASE_URL}mediapipe`, location.href).href
      const model = await createPoseWallModel(base, players)
      if (generation !== this.generation) { model.close(); return }
      this.model = model
      this.entry.hidden = true
      this.play.hidden = false
      this.get<HTMLButtonElement>('.pose-wall-stop').focus({ preventScroll: true })
      this.frame = requestAnimationFrame(this.tick)
    } catch (cause) {
      if (generation !== this.generation) return
      this.stop(true)
      error.textContent = stage === 'graphics' ? '3D 화면을 열지 못했어요. 브라우저의 그래픽 가속을 확인해 주세요.'
        : stage === 'tracking' ? '전신 인식을 준비하지 못했어요. 카메라를 다시 켜 주세요.'
        : cameraFailure(cause, stage === 'playback')
    }
  }

  private requestCamera(facing: CameraFacing, exact = false) {
    return requestChoirCamera(constraints => navigator.mediaDevices.getUserMedia(constraints), exact ? { exact: facing } : facing)
  }

  private async attachCamera(stream: MediaStream, requested: CameraFacing, generation: number) {
    if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return false }
    this.stream = stream
    const track = stream.getVideoTracks()[0]
    track?.addEventListener('ended', () => {
      if (this.stream !== stream) return
      this.stop(true)
      this.text('.pose-wall-error', '카메라 연결이 끊겼어요.')
    }, { once: true })
    this.video.srcObject = stream
    await this.video.play()
    if (generation !== this.generation) return false
    const facing = track?.getSettings().facingMode
    this.facing = facing === 'user' || facing === 'environment' ? facing : requested
    this.root.dataset.facing = this.facing
    this.flipButton.textContent = this.facing === 'user' ? '후면 전환' : '전면 전환'
    return true
  }

  private async flipCamera() {
    if (!this.stream || this.switchingCamera || this.round.phase === 'over') return
    const generation = this.generation, previous = this.facing
    const next = previous === 'user' ? 'environment' : 'user'
    this.switchingCamera = this.flipButton.disabled = true
    this.text('.pose-wall-camera-status', '카메라를 전환하고 있어요.')
    this.releaseCamera()
    try {
      if (!await this.attachCamera(await this.requestCamera(next, true), next, generation)) return
      this.text('.pose-wall-camera-status', this.facing === next ? '' : '전환할 카메라를 찾지 못했어요.')
    } catch {
      if (generation !== this.generation) return
      this.releaseCamera()
      try {
        if (await this.attachCamera(await this.requestCamera(previous), previous, generation)) {
          this.text('.pose-wall-camera-status', '전환할 카메라를 열지 못했어요.')
        }
      } catch (error) {
        if (generation !== this.generation) return
        this.stop(true)
        this.text('.pose-wall-error', cameraFailure(error))
      }
    } finally {
      if (generation === this.generation) {
        const { score, misses, practice, players } = this.round
        this.round = Object.assign(new PoseWallRound(players), { score, misses, practice })
        this.switchingCamera = this.flipButton.disabled = false
      }
    }
  }

  private releaseCamera() {
    const stream = this.stream
    this.stream = undefined
    stream?.getTracks().forEach(track => track.stop())
    this.video.pause()
    this.video.srcObject = null
    this.person.hidden = true
    this.bodies = []
    this.maskSource = undefined
    this.sampled = -Infinity
    this.videoTime = -1
  }

  private tick = (now: number) => {
    if (this.switchingCamera) { this.frame = requestAnimationFrame(this.tick); return }
    try {
      const sampleInterval = this.round.players === 2 ? 110 : 75
      if (this.round.phase !== 'over' && now - this.sampled >= sampleInterval && this.video.readyState >= 2 && this.videoTime !== this.video.currentTime) {
        this.videoTime = this.video.currentTime
        this.sampled = now
        const ratio = Math.min(1, 408 / Math.max(this.video.videoWidth, this.video.videoHeight))
        const width = Math.max(1, Math.round(this.video.videoWidth * ratio))
        const height = Math.max(1, Math.round(this.video.videoHeight * ratio))
        if (this.input.width !== width || this.input.height !== height) {
          this.input.width = width
          this.input.height = height
        }
        const mirror = this.facing === 'user'
        this.inputContext.setTransform(mirror ? -1 : 1, 0, 0, 1, mirror ? width : 0, 0)
        this.inputContext.drawImage(this.video, 0, 0, width, height)
        this.bodies = readBodies(this.model!, this.input, now)
      }

      const bodies = now - this.sampled < 350 ? this.bodies : []
      const before = this.round.phase
      this.round.advance(now, bodies, this.video.videoWidth, this.video.videoHeight, this.sampled)
      this.stage!.draw(this.round, this.root.clientWidth, this.root.clientHeight, this.video.videoWidth, this.video.videoHeight)
      this.renderOverlay(bodies, now)
      if (before !== 'over' && this.round.phase === 'over') this.get<HTMLButtonElement>('.pose-wall-restart').focus({ preventScroll: true })
      this.frame = requestAnimationFrame(this.tick)
    } catch {
      this.stop(true)
      this.get('.pose-wall-error').textContent = '전신 인식이 중단됐어요. 다시 시작해 주세요.'
    }
  }

  private renderOverlay(bodies: BodyPose[], now: number) {
    const { phase, outcome, countdown, score, misses, players, opening, preset, practice, feedback } = this.round
    this.root.dataset.phase = phase === 'passing' ? outcome! : phase
    this.root.dataset.players = String(players)
    const portrait = players === 2 && this.root.clientWidth < this.root.clientHeight
    const prompt = phase === 'waiting' ? (portrait ? '휴대폰을 가로로 돌리고 두 사람이 나란히 서세요'
      : players === 2 ? '두 사람이 좌우 자리에 서서 전신을 보여 주세요' : '바닥선에 맞춰 머리부터 발끝까지 보여 주세요')
      : phase === 'countdown' || phase === 'wall' ? (preset?.cue ?? '')
      : phase === 'passing' ? (outcome === 'pass' ? '통과!' : outcome === 'hit' ? (practice ? '연습 끝! 다음 자세를 따라 해 보세요' : '충돌!') : '자세를 다시 확인할게요') : ''
    this.text('.pose-wall-feedback p', prompt)
    this.get('.pose-wall-count').hidden = phase !== 'countdown'
    this.text('.pose-wall-count', String(countdown))
    this.text('.pose-wall-score', String(score))
    this.text('.pose-wall-misses', `${misses} / ${allowedMisses + 1}`)
    this.get('.pose-wall-practice').hidden = !practice
    this.end.hidden = phase !== 'over'
    if (phase === 'over') this.text('.pose-wall-final-score', `통과한 벽 ${score}개`)

    this.floor.hidden = !opening || (phase !== 'waiting' && phase !== 'countdown')
    if (!this.floor.hidden && opening !== this.floorOpening) {
      this.drawFloor(opening!)
      this.floorOpening = opening
    }
    const showPeople = (phase === 'wall' || phase === 'passing') && bodies.some(body => body.mask)
    this.person.hidden = !showPeople
    if (showPeople) this.drawPeople(bodies)
    this.coachPanel.hidden = !preset || phase === 'over'
    if (preset && !this.coachPanel.hidden) {
      this.coachPanel.setAttribute('aria-label', preset.name)
      this.coach!.draw(preset, feedback, now)
      this.coachLabels.forEach((label, i) => {
        label.hidden = i >= players
        const prefix = players === 2 ? (i === 0 ? '왼쪽 · ' : '오른쪽 · ') : ''
        const state = feedback[i] ?? 'waiting'
        const value = prefix + (state === 'ready' ? '유지' : state === 'adjust' ? '자세 조정' : phase === 'wall' ? '인식 중' : '따라 하기')
        if (label.textContent !== value) label.textContent = value
        label.dataset.state = state
      })
    }
  }

  private drawFloor({ figures, frameWidth, frameHeight }: WallOpening) {
    const width = this.floor.width = frameWidth * 4, height = this.floor.height = frameHeight * 4
    const context = this.floor.getContext('2d')!
    const y = Math.min(.945, Math.max(.81, Math.max(...figures.map(figure => figure[9].y)) + .025)) * height
    context.strokeStyle = '#f8f6d8cc'
    context.lineWidth = 2.5
    context.setLineDash([7, 7])
    context.beginPath()
    context.moveTo(width * .13, y)
    context.lineTo(width * .87, y)
    context.stroke()
    context.setLineDash([])
    context.fillStyle = '#d8ff96'
    for (const figure of figures) for (const index of [9, 12]) {
      context.beginPath()
      context.ellipse(figure[index].x * width, y, width * .019, width * .0065, 0, 0, Math.PI * 2)
      context.fill()
    }
  }

  private drawPeople(bodies: BodyPose[]) {
    const { width, height } = this.input
    if (this.person.width !== width || this.person.height !== height) {
      this.person.width = width
      this.person.height = height
    }
    if (bodies !== this.maskSource) {
      const { mask } = bodies.find(body => body.mask)!
      this.stamp.width = mask!.width
      this.stamp.height = mask!.height
      const maskContext = this.stamp.getContext('2d')!
      const bitmap = maskContext.createImageData(this.stamp.width, this.stamp.height)
      for (const body of bodies) {
        if (!body.mask) continue
        for (let i = 0; i < body.mask.data.length; i++) bitmap.data[i * 4 + 3] = Math.max(bitmap.data[i * 4 + 3], body.mask.data[i])
      }
      maskContext.putImageData(bitmap, 0, 0)
      this.maskSource = bodies
    }
    const context = this.person.getContext('2d')!
    context.clearRect(0, 0, width, height)
    if (this.video.readyState < 2) return
    const mirror = this.facing === 'user'
    context.save()
    context.setTransform(mirror ? -1 : 1, 0, 0, 1, mirror ? width : 0, 0)
    context.drawImage(this.video, 0, 0, width, height)
    context.restore()
    context.globalCompositeOperation = 'destination-in'
    context.drawImage(this.stamp, 0, 0, width, height)
    context.globalCompositeOperation = 'source-over'
  }

  private text(selector: string, value: string) {
    const node = this.get(selector)
    if (node.textContent !== value) node.textContent = value
  }

  private stop(focus = false) {
    this.generation++
    cancelAnimationFrame(this.frame)
    this.model?.close()
    this.model = undefined
    this.stage?.close()
    this.stage = undefined
    this.coach?.close()
    this.coach = undefined
    this.releaseCamera()
    const { players } = this.round
    this.round = new PoseWallRound(players)
    this.floorOpening = undefined
    this.facing = 'user'
    this.switchingCamera = this.flipButton.disabled = false
    this.entry.hidden = false
    this.play.hidden = this.end.hidden = this.person.hidden = true
    this.floor.hidden = this.coachPanel.hidden = true
    this.startButtons.forEach(button => { button.disabled = false })
    delete this.root.dataset.camera
    delete this.root.dataset.facing
    delete this.root.dataset.phase
    this.text('.pose-wall-error', '')
    this.text('.pose-wall-camera-status', '')
    if (focus) this.startButtons[players - 1].focus({ preventScroll: true })
  }
}
