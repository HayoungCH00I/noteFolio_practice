import { chargeStrength, samplePath, StirDetector, ScrollRushDetector } from './gestures.ts'
import type { Point } from './gestures.ts'
import { Pigeons } from './pigeons.ts'
import { NightSnacks, chooseSnack } from './snacks.ts'
import type { SnackKind } from './snacks.ts'

type Shape = 'bloom' | 'ring' | 'heart' | 'star' | 'willow' | 'spiral'
interface Particle extends Point {
  vx: number; vy: number; age: number; life: number; size: number
  hue: number; drag: number; gravity: number; tail: Point[]; shimmer: boolean
}
interface Burst extends Point { due: number; strength: number; snack: SnackKind }
interface Gesture { id: number; start: number; points: Point[]; distance: number }
interface Star extends Point { radius: number; phase: number; brightness: number }

const TAU = Math.PI * 2
const shapes: Shape[] = ['bloom', 'ring', 'heart', 'star', 'willow', 'spiral']
const random = (min: number, max: number) => min + Math.random() * (max - min)

export class Fireworks {
  onStir: (() => void) | null = null
  private mode: 'night' | 'day' = 'night'
  private active = true
  private transitioning = false
  private stir = new StirDetector()
  private scrollRush = new ScrollRushDetector()
  private pigeons = new Pigeons()
  private snacks = new NightSnacks()
  private ctx: CanvasRenderingContext2D
  private sky: CanvasRenderingContext2D
  private stars: Star[] = []
  private particles: Particle[] = []
  private bursts: Burst[] = []
  private gesture: Gesture | null = null
  private keyboardStart: number | null = null
  private width = 0
  private height = 0
  private lastFrame = 0
  private lastSky = 0
  private frameId = 0
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  private canvas: HTMLCanvasElement
  private starCanvas: HTMLCanvasElement
  private announcement: HTMLParagraphElement

  constructor(
    canvas: HTMLCanvasElement,
    starCanvas: HTMLCanvasElement,
    clear: HTMLButtonElement,
    announcement: HTMLParagraphElement,
  ) {
    this.canvas = canvas
    this.starCanvas = starCanvas
    this.announcement = announcement
    const ctx = canvas.getContext('2d')
    const sky = starCanvas.getContext('2d')
    if (!ctx || !sky) throw new Error('이 브라우저는 Canvas를 지원하지 않습니다.')
    this.ctx = ctx
    this.sky = sky
    this.resize()
    window.addEventListener('resize', () => { if (this.active) this.resize() })
    canvas.addEventListener('pointerdown', (event) => this.pointerDown(event))
    canvas.addEventListener('pointermove', (event) => this.pointerMove(event))
    canvas.addEventListener('pointerup', (event) => this.pointerUp(event))
    canvas.addEventListener('wheel', (event) => {
      if (!this.active || this.transitioning || event.ctrlKey || !this.onStir) return
      if (this.scrollRush.add(event.deltaX, event.deltaY, event.deltaMode, performance.now(), this.height)) this.onStir()
    }, { passive: true })
    canvas.addEventListener('pointercancel', () => this.cancel())
    canvas.addEventListener('lostpointercapture', () => this.cancel())
    canvas.addEventListener('contextmenu', (event) => event.preventDefault())
    canvas.addEventListener('keydown', (event) => {
      if (!this.active || this.transitioning || (event.code !== 'Space' && event.code !== 'Enter')) return
      event.preventDefault()
      if (this.keyboardStart === null && !this.gesture) this.keyboardStart = performance.now()
    })
    canvas.addEventListener('keyup', (event) => {
      if (!this.active || this.transitioning || (event.code !== 'Space' && event.code !== 'Enter')) return
      event.preventDefault()
      if (this.keyboardStart !== null) {
        this.explode(this.width / 2, this.height * 0.46, chargeStrength(performance.now() - this.keyboardStart))
        this.keyboardStart = null
        this.announcement.textContent = this.mode === 'night' ? '밤하늘 가운데에 폭죽이 피어났습니다.' : '하늘 가운데에서 비둘기가 날아오릅니다.'
      }
    })
    canvas.addEventListener('blur', () => { this.keyboardStart = null })
    clear.addEventListener('click', () => {
      this.clear()
      this.announcement.textContent = '하늘을 비웠습니다.'
    })
    window.addEventListener('blur', () => this.cancel())
    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(this.frameId)
      this.clear()
      if (!document.hidden && this.active) {
        this.lastFrame = performance.now()
        this.frameId = requestAnimationFrame(this.animate)
      }
    })
    this.frameId = requestAnimationFrame(this.animate)
  }

  setActive(active: boolean) {
    if (this.active === active) return
    this.active = active
    cancelAnimationFrame(this.frameId)
    this.clear()
    this.stir.reset()
    this.scrollRush.reset()
    if (active && !document.hidden) {
      this.resize()
      this.lastFrame = 0
      this.frameId = requestAnimationFrame(this.animate)
    }
  }

  setTransitioning(value: boolean) {
    this.transitioning = value
    this.clear()
    this.stir.reset()
    this.scrollRush.reset()
  }

  setScene(mode: 'night' | 'day') {
    this.mode = mode
    this.clear()
    this.stir.reset()
    this.scrollRush.reset()
    this.starCanvas.style.opacity = mode === 'day' ? '0' : '1'
  }

  private resize() {
    this.width = this.canvas.clientWidth
    this.height = this.canvas.clientHeight
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    for (const [canvas, context] of [[this.canvas, this.ctx], [this.starCanvas, this.sky]] as const) {
      canvas.width = Math.round(this.width * ratio)
      canvas.height = Math.round(this.height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
    this.stars = Array.from({ length: Math.min(260, Math.floor(this.width * this.height / 4300)) }, () => ({
      x: random(0, this.width), y: random(0, this.height * 0.92), radius: random(0.4, 1.25),
      phase: random(0, TAU), brightness: random(0.15, 0.75),
    }))
    this.clear()
    this.drawStars(performance.now())
  }

  private point(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect()
    return { x: Math.max(0, Math.min(this.width, event.clientX - rect.left)), y: Math.max(0, Math.min(this.height, event.clientY - rect.top)) }
  }

  private pointerDown(event: PointerEvent) {
    if (!this.active || this.transitioning || this.gesture || this.keyboardStart !== null || !event.isPrimary || event.button !== 0) return
    event.preventDefault()
    this.canvas.focus({ preventScroll: true })
    this.canvas.setPointerCapture(event.pointerId)
    this.gesture = { id: event.pointerId, start: performance.now(), points: [this.point(event)], distance: 0 }
  }

  private addPoint(point: Point) {
    const gesture = this.gesture
    if (!gesture) return
    const previous = gesture.points[gesture.points.length - 1]!
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y)
    if (distance < 2) return
    gesture.distance += distance
    gesture.points.push(point)
    // Bound memory for very long gestures while retaining their ordered route.
    if (gesture.points.length > 1500) {
      gesture.points = gesture.points.filter((_, index) => index % 2 === 0 || index === gesture.points.length - 1)
    }
  }

  private pointerMove(event: PointerEvent) {
    if (!this.active || this.transitioning || !event.isPrimary) return
    if (this.onStir && this.stir.add(this.point(event), performance.now())) {
      this.onStir()
      return
    }
    if (this.gesture?.id !== event.pointerId) return
    event.preventDefault()
    const events = event.getCoalescedEvents?.() ?? []
    for (const sample of events.length ? events : [event]) this.addPoint(this.point(sample))
  }

  private pointerUp(event: PointerEvent) {
    if (!this.active || this.transitioning || this.gesture?.id !== event.pointerId) return
    this.addPoint(this.point(event))
    const gesture = this.gesture
    const strength = chargeStrength(performance.now() - gesture.start)
    const snack = chooseSnack()
    this.gesture = null
    if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId)
    if (gesture.distance > 30) {
      const points = samplePath(gesture.points)
      const now = performance.now()
      const interval = Math.min(95, 2400 / Math.max(points.length - 1, 1))
      this.bursts.push(...points.map((point, index) => ({ ...point, due: now + index * interval, strength, snack })))
      this.bursts = this.bursts.slice(-160)
      this.announcement.textContent = this.mode === 'night' ? `그린 경로를 따라 ${points.length}개의 폭죽이 차례로 피어납니다.` : '그린 경로를 따라 비둘기들이 차례로 날아오릅니다.'
    } else {
      const point = this.point(event)
      this.explode(point.x, point.y, strength, snack)
      this.announcement.textContent = this.mode === 'night' ? '손끝에서 폭죽이 피어났습니다.' : '손끝에서 비둘기들이 날아오릅니다.'
    }
  }

  private cancel() {
    const id = this.gesture?.id
    this.gesture = null
    this.keyboardStart = null
    if (id !== undefined && this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id)
  }

  private clear() {
    this.cancel()
    this.particles = []
    this.pigeons.clear()
    this.snacks.clear()
    this.bursts = []
    this.ctx.clearRect(0, 0, this.width, this.height)
  }

  private explode(x: number, y: number, strength: number, snack: SnackKind = chooseSnack()) {
    if (!this.active || this.transitioning) return
    if (this.mode === 'day') {
      this.pigeons.release(x, y, strength, this.reducedMotion)
      return
    }
    if (this.snacks.nextIsSnack()) {
      this.snacks.serve(x, y, strength, snack, this.reducedMotion)
      return
    }
    const shape = shapes[Math.floor(Math.random() * shapes.length)]!
    const hue = random(0, 360)
    const count = Math.round((this.reducedMotion ? 42 : 85) + strength * 42)
    const speed = 110 * strength
    const rotation = random(-0.3, 0.3)
    const lifeScale = this.reducedMotion ? 0.65 : 1
    for (let i = 0; i < count; i++) {
      const angle = i / count * TAU + rotation
      let vx = Math.cos(angle)
      let vy = Math.sin(angle)
      let radius = random(0.3, 1)
      if (shape === 'ring') radius = i % 3 === 0 ? 0.55 : random(0.94, 1.04)
      if (shape === 'heart') {
        vx = Math.pow(Math.sin(angle), 3)
        vy = -(13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle)) / 16
        radius = random(0.9, 1.05)
      }
      if (shape === 'star') radius = (0.47 + 0.53 * Math.pow((Math.cos(5 * angle) + 1) / 2, 2)) * random(0.9, 1.05)
      if (shape === 'spiral') {
        radius = 0.25 + (i % 35) / 35 * 0.85
        vx = Math.cos(angle * 3)
        vy = Math.sin(angle * 3)
      }
      this.particles.push({
        x, y, vx: vx * speed * radius, vy: vy * speed * radius,
        age: 0, life: random(1.25, shape === 'willow' ? 2.7 : 2.05) * lifeScale,
        size: random(0.85, 1.9), hue: (hue + (i % 5 === 0 ? 45 : random(-13, 13)) + 360) % 360,
        drag: shape === 'willow' ? 0.82 : 1.1, gravity: shape === 'willow' ? 65 : 35,
        tail: [{ x, y }], shimmer: Math.random() < 0.22,
      })
    }
    this.particles = this.particles.slice(-4500)
  }

  private drawStars(now: number) {
    this.sky.clearRect(0, 0, this.width, this.height)
    for (const star of this.stars) {
      const twinkle = this.reducedMotion ? 1 : 0.75 + Math.sin(now / 1800 + star.phase) * 0.25
      this.sky.fillStyle = `rgba(204,220,249,${star.brightness * twinkle})`
      this.sky.beginPath()
      this.sky.arc(star.x, star.y, star.radius, 0, TAU)
      this.sky.fill()
      if (star.radius > 1.15 && star.brightness > 0.55) {
        this.sky.fillStyle = `rgba(204,220,249,${star.brightness * twinkle * 0.25})`
        this.sky.fillRect(star.x - 3, star.y - 0.3, 6, 0.6)
        this.sky.fillRect(star.x - 0.3, star.y - 3, 0.6, 6)
      }
    }
  }

  private drawGesture(now: number) {
    const points = this.gesture?.points
    const point = points?.[points.length - 1] ?? (this.keyboardStart !== null ? { x: this.width / 2, y: this.height * 0.46 } : null)
    if (!point) return
    const start = this.gesture?.start ?? this.keyboardStart!
    const strength = chargeStrength(now - start)
    const ctx = this.ctx
    ctx.save()
    if (points && points.length > 1) {
      ctx.beginPath()
      ctx.moveTo(points[0]!.x, points[0]!.y)
      for (const p of points) ctx.lineTo(p.x, p.y)
      ctx.setLineDash([2, 9])
      ctx.lineDashOffset = -now / 80
      ctx.lineWidth = 1
      ctx.strokeStyle = this.mode === 'day' ? '#496e8c88' : '#e9d5b77a'
      ctx.stroke()
      ctx.setLineDash([])
    }
    const radius = 12 + strength * 14
    const glow = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 2)
    glow.addColorStop(0, '#fff1ca5c')
    glow.addColorStop(0.4, '#dbc69b14')
    glow.addColorStop(1, '#dbc69b00')
    ctx.fillStyle = glow
    ctx.fillRect(point.x - radius * 2, point.y - radius * 2, radius * 4, radius * 4)
    ctx.beginPath()
    ctx.arc(point.x, point.y, radius, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min((now - start) / 3200, 1))
    ctx.strokeStyle = this.mode === 'day' ? '#54778eaa' : '#f5dfb9b0'
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(point.x, point.y, 2.5, 0, TAU)
    ctx.fillStyle = '#fff3d8'
    ctx.fill()
    ctx.restore()
  }

  private animate = (now: number) => {
    if (!this.active) return
    const dt = this.lastFrame ? Math.min((now - this.lastFrame) / 1000, 0.04) : 1 / 60
    this.lastFrame = now
    if (this.mode === 'night' && now - this.lastSky > 80) {
      this.drawStars(now)
      this.lastSky = now
    }
    const ready = this.bursts.filter((burst) => burst.due <= now)
    this.bursts = this.bursts.filter((burst) => burst.due > now)
    for (const burst of ready) this.explode(burst.x, burst.y, burst.strength, burst.snack)
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.globalCompositeOperation = 'lighter'
    for (const particle of this.particles) {
      particle.age += dt
      particle.tail.push({ x: particle.x, y: particle.y })
      if (particle.tail.length > 6) particle.tail.shift()
      const damping = Math.exp(-particle.drag * dt)
      particle.vx *= damping
      particle.vy = particle.vy * damping + particle.gravity * dt
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
      const remaining = Math.max(0, 1 - particle.age / particle.life)
      const alpha = remaining * (particle.shimmer ? 0.65 + Math.sin(particle.age * 38) * 0.35 : 1)
      ctx.strokeStyle = `hsla(${particle.hue},90%,69%,${alpha * 0.6})`
      ctx.lineWidth = particle.size * remaining
      if (ctx.lineWidth > 0 && particle.tail.length) {
        ctx.beginPath()
        ctx.moveTo(particle.tail[0]!.x, particle.tail[0]!.y)
        for (const p of particle.tail) ctx.lineTo(p.x, p.y)
        ctx.lineTo(particle.x, particle.y)
        ctx.stroke()
      }
      ctx.fillStyle = `hsla(${particle.hue},85%,80%,${alpha})`
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, Math.max(0.1, particle.size * remaining), 0, TAU)
      ctx.fill()
    }
    this.particles = this.particles.filter((particle) => particle.age < particle.life)
    ctx.globalCompositeOperation = 'source-over'
    this.snacks.draw(ctx, dt)
    this.pigeons.draw(ctx, dt)
    this.drawGesture(now)
    this.frameId = requestAnimationFrame(this.animate)
  }
}
