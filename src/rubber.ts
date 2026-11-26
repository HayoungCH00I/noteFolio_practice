import { FruitTracker } from './fruit-tracker.ts'
import { cameraFailure, trackingFailure } from './choir-camera-errors.ts'
import { Dough, facePlacement, pinchDistance, pointedFace, RubGesture, type Point } from './rubber-core.ts'
import type { TrackingSample } from './fruit-vision.ts'

const oval = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109]
const vertex = `attribute vec2 p, q; varying vec2 uv;
void main() { uv = p; gl_Position = vec4(q.x*2.0-1.0, 1.0-q.y*2.0, 0, 1); }`
const fragment = `precision mediump float; varying vec2 uv; uniform sampler2D image; void main() { gl_FragColor = texture2D(image, uv); }`

type Grab = { grabbed: boolean; locked: boolean; previous: Point }
const newGrab = (): Grab => ({ grabbed: false, locked: false, previous: { x: 0, y: 0 } })

export class RubberScene {
  private video = document.createElement('video')
  private camera: HTMLCanvasElement
  private face: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private source = document.createElement('canvas')
  private sourceCtx = this.source.getContext('2d', { willReadFrequently: true })!
  private mask = document.createElement('canvas')
  private maskCtx = this.mask.getContext('2d')!
  private gl: WebGLRenderingContext
  private program: WebGLProgram
  private texture: WebGLTexture
  private dough = new Dough()
  private mesh: WebGLBuffer
  private tracker?: FruitTracker
  private stream?: MediaStream
  private active = false
  private token = 0
  private frame = 0
  private busy = false
  private lastSample = 0
  private lastVideo = -1
  private sample?: TrackingSample
  private sampleAt = 0
  private grabs = [newGrab(), newGrab()]
  private rub = new RubGesture()
  private lastFace?: NonNullable<TrackingSample['faces']>
  private faceAt = 0
  private rubSample = 0
  private changedAt = 0
  private restoredAt = 0
  private selectedFace = 0
  private photos: HTMLImageElement[] = []
  private root: HTMLElement
  constructor(root: HTMLElement) {
    this.root = root
    this.camera = root.querySelector('.rubber-camera')!; this.face = root.querySelector('.rubber-face')!; this.ctx = this.camera.getContext('2d')!
    const gl = this.face.getContext('webgl', { alpha: true, premultipliedAlpha: true })
    if (!gl) throw new Error('WebGL unavailable')
    this.gl = gl
    const shader = (type: number, source: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader compilation failed'); return s }
    const program = gl.createProgram()!; gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex)); gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader linking failed')
    this.program = program; gl.useProgram(program)
    this.mesh = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh); gl.bufferData(gl.ARRAY_BUFFER, this.dough.vertices.byteLength, gl.DYNAMIC_DRAW)
    for (const [name, offset] of [['p', 0], ['q', 8]] as const) { const loc = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 16, offset) }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.dough.indices, gl.STATIC_DRAW)
    this.texture = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, this.texture); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    this.video.muted = true; this.video.playsInline = true
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-rubber-face]')) {
      const index = Number(button.dataset.rubberFace)
      if (index) { const image = new Image(); image.src = (button.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1] ?? ''); this.photos[index] = image }
      button.addEventListener('click', event => { if (event.detail === 0) this.selectFace(index) })
    }
    root.querySelector('.rubber-start')!.addEventListener('click', () => { void this.start() })
    root.querySelector('.rubber-stop')!.addEventListener('click', () => this.stop())
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.stream) this.stop() })
  }
  setActive(active: boolean) { this.active = active; if (!active) this.stop() }
  private selectFace(index: number) {
    if (index && !this.photos[index]?.naturalWidth) { this.status('사진을 불러오는 중이에요.'); return false }
    this.selectedFace = index; this.changedAt = performance.now()
    for (const option of this.root.querySelectorAll<HTMLButtonElement>('[data-rubber-face]')) option.setAttribute('aria-pressed', String(Number(option.dataset.rubberFace) === index))
    return true
  }
  private status(text: string) { this.root.querySelector('.rubber-status')!.textContent = text }
  private error(text: string) { this.root.querySelector('.rubber-error')!.textContent = text }
  private async start() {
    if (!this.active || this.stream) return
    const button = this.root.querySelector<HTMLButtonElement>('.rubber-start')!; if (button.disabled) return
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { this.error('카메라를 사용하려면 localhost 또는 HTTPS로 접속해 주세요.'); return }
    const token = ++this.token; button.disabled = true; this.error('카메라 사용을 허용해 주세요.')
    let phase: 'camera' | 'tracking' = 'camera'
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } }, audio: false })
      if (!this.active || token !== this.token) { stream.getTracks().forEach(track => track.stop()); return }
      this.stream = stream; this.video.srcObject = stream; await this.video.play()
      if (token !== this.token) return
      phase = 'tracking'; this.error('얼굴과 손을 준비하고 있어요…')
      const tracker = new FruitTracker('rubber'); this.tracker = tracker
      await tracker.init(new URL(`${import.meta.env.BASE_URL}mediapipe`, location.href).href)
      if (token !== this.token) { tracker.close(); return }
      for (const canvas of [this.camera, this.face, this.source, this.mask]) { canvas.width = this.video.videoWidth; canvas.height = this.video.videoHeight }
      this.root.querySelector<HTMLElement>('.rubber-entry')!.hidden = true; this.root.querySelector<HTMLElement>('.rubber-stop')!.hidden = false; this.root.querySelector<HTMLElement>('.rubber-faces')!.hidden = false
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (token === this.token) { this.stop(); this.error('카메라 연결이 끝났어요. 다시 켜 주세요.') } }, { once: true })
      this.lastSample = 0; this.lastVideo = -1; this.frame = requestAnimationFrame(this.tick)
    } catch (error) {
      if (token !== this.token) return
      this.stop(); this.error(phase === 'camera' ? cameraFailure(error) : trackingFailure(error))
    } finally { if (token === this.token) button.disabled = false }
  }
  private stop() {
    this.token++; cancelAnimationFrame(this.frame); this.tracker?.close(); this.tracker = undefined; this.stream?.getTracks().forEach(t => t.stop()); this.stream = undefined; this.video.pause(); this.video.srcObject = null
    this.busy = false; this.sample = undefined; this.grabs = [newGrab(), newGrab()]; this.dough.offsets.fill(0); this.rub.reset(); this.rubSample = 0; this.lastFace = undefined; this.faceAt = 0; this.changedAt = this.restoredAt = 0
    this.ctx.clearRect(0, 0, this.camera.width, this.camera.height); this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    this.root.querySelector<HTMLButtonElement>('.rubber-start')!.disabled = false; this.root.querySelector<HTMLElement>('.rubber-entry')!.hidden = false; this.root.querySelector<HTMLElement>('.rubber-stop')!.hidden = true; this.root.querySelector<HTMLElement>('.rubber-faces')!.hidden = true; this.error('')
  }
  private async track(now: number) {
    const tracker = this.tracker; if (!tracker || this.busy || now - this.lastSample < 50 || this.video.currentTime === this.lastVideo) return
    this.busy = true; this.lastSample = now; this.lastVideo = this.video.currentTime
    try { const sample = await tracker.sample(this.video, now, true); if (tracker === this.tracker) { this.sample = sample; this.sampleAt = performance.now(); if (sample.faces && sample.faces.length >= 455) { this.lastFace = sample.faces; this.faceAt = this.sampleAt } } }
    catch { if (tracker === this.tracker) { this.sample = undefined; this.status('손과 얼굴 추적을 다시 시도하고 있어요.') } }
    finally { if (tracker === this.tracker) this.busy = false }
  }
  private tick = (now: number) => {
    if (!this.active || !this.stream) return
    void this.track(now)
    this.render(now); this.frame = requestAnimationFrame(this.tick)
  }
  private render(now: number) {
    const w = this.camera.width, h = this.camera.height, ctx = this.ctx, gl = this.gl
    ctx.drawImage(this.video, 0, 0, w, h); gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
    const hands = now - this.sampleAt < 500 ? this.sample?.hands ?? [] : []
    const options = [...this.root.querySelectorAll<HTMLButtonElement>('[data-rubber-face]')]
    const hit = pointedFace(hands, w, h, this.root.getBoundingClientRect(), options.map(option => option.getBoundingClientRect()))
    if (hit >= 0 && Number(options[hit]!.dataset.rubberFace) !== this.selectedFace) this.selectFace(Number(options[hit]!.dataset.rubberFace))
    const face = now - this.faceAt < 1200 && now - this.sampleAt < 500 ? this.lastFace : undefined
    if (!face || face.length < 455) { for (const grab of this.grabs) grab.grabbed = false; this.rub.reset(); this.status('얼굴을 카메라에 보여주세요'); return }
    const path = new Path2D(), points = oval.map(i => ({ x: face[i]!.x * w, y: face[i]!.y * h }))
    const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
    const first = mid(points[points.length - 1]!, points[0]!); path.moveTo(first.x, first.y)
    points.forEach((p, i) => { const next = mid(p, points[(i + 1) % points.length]!); path.quadraticCurveTo(p.x, p.y, next.x, next.y) }); path.closePath()
    const center = face[1]!, seen = [false, false]
    const faceWidth = Math.max(.04, Math.abs(face[454]!.x - face[234]!.x)), faceHeight = Math.max(.04, Math.abs(face[152]!.y - face[10]!.y))
    for (let i = 0; i < hands.length; i++) {
      const hand = hands[i]!, label = this.sample?.handedness?.[i]
      let index = label === 'Left' ? 0 : label === 'Right' ? 1 : i
      if (index > 1 || seen[index]) index = seen[0] ? 1 : 0
      const grab = this.grabs[index]!; seen[index] = true
      if (hand.length < 21) continue
      const distance = pinchDistance(hand), tip = { x: (hand[4]!.x + hand[8]!.x) / 2, y: (hand[4]!.y + hand[8]!.y) / 2 }
      if (distance > .55) grab.locked = false
      const local = { x: (tip.x - center.x) / faceWidth, y: (tip.y - center.y) / faceHeight }
      if (!grab.grabbed && !grab.locked && distance < .35) {
        const source = this.dough.sourceAt(local)
        if (source && ctx.isPointInPath(path, (center.x + source.x * faceWidth) * w, (center.y + source.y * faceHeight) * h)) { grab.grabbed = true; grab.previous = local }
      }
      if (grab.grabbed && distance > .55) grab.grabbed = false
      if (grab.grabbed) {
        this.dough.pull(grab.previous, { x: local.x - grab.previous.x, y: local.y - grab.previous.y }); grab.previous = local

      }
    }
    for (let i = 0; i < 2; i++) { const grab = this.grabs[i]!; if (!seen[i]) { grab.grabbed = false; grab.locked = false } }
    if (this.sample && this.sample.timestamp !== this.rubSample) {
      const elapsed = this.rubSample ? Math.min(.15, Math.max(0, (this.sample.timestamp - this.rubSample) / 1000)) : 0
      this.rubSample = this.sample.timestamp
      if (this.rub.add(hands, face, now)) { this.restoredAt = now; this.dough.restore(elapsed * .1); for (const grab of this.grabs) { grab.grabbed = false; grab.locked = true } }
    }
    this.status(now - this.restoredAt < 250 && this.restoredAt ? '문지를수록 얼굴이 천천히 돌아와요' : now - this.changedAt < 1800 && this.changedAt ? '얼굴이 바뀌었어요' : this.grabs.some(grab => grab.grabbed) ? '양손으로 얼굴을 늘려 보세요' : '검지로 오른쪽 사진을 가리켜 얼굴을 바꿔보세요')
    this.sourceCtx.drawImage(this.video, 0, 0, w, h)
    const colors = [face[50]!, face[280]!].map(p => this.sourceCtx.getImageData(Math.max(0, Math.min(w - 1, Math.round(p.x * w))), Math.max(0, Math.min(h - 1, Math.round(p.y * h))), 1, 1).data)
    ctx.fillStyle = `rgb(${(colors[0]![0]! + colors[1]![0]!) / 2}, ${(colors[0]![1]! + colors[1]![1]!) / 2}, ${(colors[0]![2]! + colors[1]![2]!) / 2})`; ctx.fill(path)
    this.maskCtx.clearRect(0, 0, w, h); this.maskCtx.save(); this.maskCtx.clip(path)
    if (this.selectedFace) {
      const photo = this.photos[this.selectedFace]!, crops = [[0,0,0,0], [85,112,242,339], [382,122,210,243], [430,245,364,406]]
      const [x, y, width, height] = crops[this.selectedFace]!
      const placement = facePlacement(face, w, h)
      this.maskCtx.translate(placement.x, placement.y); this.maskCtx.rotate(placement.angle); this.maskCtx.scale(-1, 1)
      this.maskCtx.drawImage(photo, x!, y!, width!, height!, -placement.width / 2, -placement.height / 2, placement.width, placement.height)
    } else this.maskCtx.drawImage(this.source, 0, 0)
    this.maskCtx.restore()
    gl.useProgram(this.program); gl.bindTexture(gl.TEXTURE_2D, this.texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.mask)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.mesh); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.dough.update(center, faceWidth, faceHeight))
    gl.drawElements(gl.TRIANGLES, this.dough.indices.length, gl.UNSIGNED_SHORT, 0)
  }
}
