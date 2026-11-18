export type Point = { x: number; y: number; z?: number }
export type FruitKind = 'watermelon' | 'peach' | 'apple' | 'avocado' | 'pineapple' | 'bomb'
export type FlyingFruit = { kind: FruitKind; x: number; y: number; vx: number; vy: number; radius: number; angle: number; spin: number }
export const fruitKinds: FruitKind[] = ['watermelon', 'peach', 'apple', 'avocado', 'pineapple']
export const roundDuration = 60_000
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0))
function angle(a: Point, b: Point, c: Point) {
  const ux = a.x - b.x, uy = a.y - b.y, uz = (a.z ?? 0) - (b.z ?? 0)
  const vx = c.x - b.x, vy = c.y - b.y, vz = (c.z ?? 0) - (b.z ?? 0)
  return Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy + uz * vz) / Math.max(1e-9, Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz))))) * 180 / Math.PI
}
const fingers = [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]] as const
export type HandPose = 'index' | 'open' | 'fist' | 'other'
export function handPose(points: Point[]): HandPose {
  if (points.length < 21) return 'other'
  let straight = 0, curled = 0
  for (let i = 0; i < fingers.length; i++) {
    const [mcp, pip, tip] = fingers[i]!
    const jointAngle = angle(points[mcp]!, points[pip]!, points[tip]!)
    const tipDistance = distance(points[tip]!, points[0]!), pipDistance = distance(points[pip]!, points[0]!)
    if (jointAngle > 155 && tipDistance > pipDistance * 1.12) straight |= 1 << i
    if (jointAngle < 150 || tipDistance < pipDistance * 1.05) curled |= 1 << i
  }
  const palm = distance(points[5]!, points[17]!), thumbDistance = distance(points[4]!, points[9]!)
  if (straight === 15 && thumbDistance > palm * .95) return 'open'
  if (thumbDistance < palm * .95) {
    if (straight & 1 && (curled & 14) === 14) return 'index'
    if (curled === 15) return 'fist'
  }
  return 'other'
}
export function isIndexOnly(points: Point[]) { return handPose(points) === 'index' }
export function coverPoint(point: Point, videoWidth: number, videoHeight: number, width: number, height: number): Point {
  const scale = Math.max(width / videoWidth, height / videoHeight)
  return { x: (width - videoWidth * scale) / 2 + (1 - point.x) * videoWidth * scale, y: (height - videoHeight * scale) / 2 + point.y * videoHeight * scale }
}
export function segmentHitsCircle(a: Point, b: Point, center: Point, radius: number) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy
  if (length < 1e-9) return false
  const t = Math.max(0, Math.min(1, ((center.x - a.x) * dx + (center.y - a.y) * dy) / length))
  return Math.hypot(center.x - a.x - t * dx, center.y - a.y - t * dy) <= radius
}
export class FruitRound {
  score = 0
  combo = 0
  bestCombo = 0
  misses = 0
  bombs = 0
  startedAt = 0
  running = false
  paused = false
  pausedAt = 0
  object?: FlyingFruit
  private nextAt = 0
  start(now: number) { this.score = this.combo = this.bestCombo = this.misses = this.bombs = 0; this.startedAt = now; this.nextAt = now + 450; this.object = undefined; this.running = true; this.paused = false; this.pausedAt = 0 }
  remaining(now: number) { return this.running ? Math.max(0, roundDuration - ((this.paused ? this.pausedAt : now) - this.startedAt)) : 0 }
  pause(now: number) {
    if (!this.running || this.paused || !this.remaining(now)) return false
    this.pausedAt = now; this.paused = true; return true
  }
  resume(now: number) {
    if (!this.running || !this.paused) return 0
    const duration = Math.max(0, now - this.pausedAt)
    this.startedAt += duration; this.nextAt += duration; this.paused = false; this.pausedAt = 0
    return duration
  }
  step(now: number, dt: number, width: number, height: number, random = Math.random) {
    if (!this.running || this.paused) return
    if (this.remaining(now) === 0) { this.running = false; this.object = undefined; return }
    const gravity = Math.max(600, height * 1.12)
    if (!this.object && now >= this.nextAt) {
      const radius = Math.max(32, Math.min(68, width * .065))
      this.object = { kind: random() < .18 ? 'bomb' : fruitKinds[Math.floor(random() * fruitKinds.length)]!, x: width * (.43 + random() * .14), y: height + radius * 1.2, vx: (random() - .5) * Math.min(100, width * .12), vy: -Math.sqrt(2 * gravity * height * .78), radius, angle: (random() - .5) * .8, spin: (random() - .5) * 2.5 }
    }
    const object = this.object
    if (object) {
      object.vy += gravity * dt; object.x += object.vx * dt; object.y += object.vy * dt; object.angle += object.spin * dt
      if (object.vy > 0 && object.y > height + object.radius * 2) {
        if (object.kind !== 'bomb') { this.combo = 0; this.misses++ }
        this.object = undefined; this.nextAt = now + 350
      }
    }
  }
  slash(a: Point, b: Point, now: number) {
    if (!this.running || this.paused || !this.remaining(now) || !this.object || !segmentHitsCircle(a, b, this.object, this.object.radius * .9)) return undefined
    const object = this.object; this.object = undefined; this.nextAt = now + 380
    if (object.kind === 'bomb') { this.bombs++; this.combo = 0 }
    else { this.score++; this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo) }
    return object
  }
}
