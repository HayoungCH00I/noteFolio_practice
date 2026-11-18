import type { Palm } from './choir-core.ts'
type Point = { x: number; y: number; z?: number }
export type GestureHand = { palm: Palm; tip: Palm; pose: 'open' | 'two' | 'three' | 'point' | 'fist' | 'other'; pitch?: number }
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
export function isCircularPath(points: Palm[]) {
  if (points.length < 10) return false
  let minX = 1, maxX = 0, minY = 1, maxY = 0, area = 0
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!, next = points[(i + 1) % points.length]!
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); area += p.x * next.y - next.x * p.y
  }
  const width = maxX - minX, height = maxY - minY
  return width > .04 && height > .04 && width / height > .4 && width / height < 2.5 && Math.abs(area) / 2 > width * height * .35
}
export function readChoirHand(points: Point[]): GestureHand | undefined {
  if (points.length < 21) return
  const extended = [5, 9, 13, 17].map(mcp => {
    const joint = points[mcp + 1]!, base = points[mcp]!, tip = points[mcp + 3]!
    const ax = base.x - joint.x, ay = base.y - joint.y, bx = tip.x - joint.x, by = tip.y - joint.y
    const cosine = (ax * bx + ay * by) / Math.max(.00001, Math.hypot(ax, ay) * Math.hypot(bx, by))
    return cosine < -.5 && distance(tip, points[0]!) > distance(joint, points[0]!) * 1.03
  })
  const [index, middle, ring, pinky] = extended, count = extended.filter(Boolean).length
  const pose = count === 4 ? 'open' : count === 0 ? 'fist' : index && !middle && !ring && !pinky ? 'point' : index && middle && !ring && !pinky ? 'two' : index && middle && ring && !pinky ? 'three' : 'other'
  let x = 0, y = 0
  for (const i of [0, 5, 9, 13, 17]) { x += points[i]!.x; y += points[i]!.y }
  const width = Math.max(.025, distance(points[5]!, points[17]!))
  const thumbOut = distance(points[4]!, points[17]!) > distance(points[2]!, points[17]!) * 1.12
  const pitch = pose === 'point' && thumbOut ? Math.max(-6, Math.min(6, (distance(points[4]!, points[8]!) / width - .85) * 8)) : undefined
  return { palm: { x: 1 - x / 5, y: y / 5 }, tip: { x: 1 - points[8]!.x, y: points[8]!.y }, pose, pitch }
}
export class ChoirGestures {
  paused = false
  resumeAt = 0
  taps = 0
  selected = -1
  scolded = -1
  pitch = 0
  private pitchTarget = 0
  private fistsSince = 0
  private candidate = -1
  private candidateSince = 0
  private selectedUntil = 0
  private scoldUntil = 0
  private previous?: Palm
  private directionX = 0
  private directionY = 0
  private anchorX = 0
  private anchorY = 0
  private reversals = 0
  private lastWag = 0
  private lastTap = 0
  private lastSeen = 0
  clearSelection() {
    this.selected = this.candidate = -1; this.candidateSince = this.selectedUntil = this.reversals = this.lastWag = 0
    this.previous = undefined; this.directionX = this.directionY = 0
  }
  reset() {
    this.paused = false; this.resumeAt = this.taps = 0; this.selected = this.scolded = -1; this.pitch = this.pitchTarget = 0
    this.fistsSince = this.candidateSince = this.selectedUntil = this.scoldUntil = this.reversals = this.lastTap = this.lastWag = this.lastSeen = 0
    this.candidate = -1; this.previous = undefined; this.directionX = this.directionY = 0
  }
  advance(now: number, dt = .05) {
    if (this.resumeAt && now >= this.resumeAt) { this.paused = false; this.resumeAt = 0; this.taps = 0 }
    if (now > this.selectedUntil) this.selected = -1
    if (now > this.scoldUntil) this.scolded = -1
    if (now - this.lastSeen > 450) { this.pitchTarget = 0; this.previous = undefined; this.fistsSince = 0; this.candidate = -1 }
    const change = (this.pitchTarget - this.pitch) * (1 - Math.exp(-dt / .55)), limit = dt * 4
    this.pitch += Math.max(-limit, Math.min(limit, change))
    if (Math.abs(this.pitchTarget - this.pitch) < .01) this.pitch = this.pitchTarget
  }
  hands(left: GestureHand | undefined, right: GestureHand | undefined, now: number, performing: boolean, target = -1) {
    this.lastSeen = now; this.pitchTarget = left?.pitch ?? 0
    if (left?.pose === 'fist' && right?.pose === 'fist') {
      this.fistsSince ||= now
      if (now - this.fistsSince >= 250) { this.paused = true; this.resumeAt = this.taps = 0; this.previous = undefined }
      return
    }
    this.fistsSince = 0
    if (right?.pose !== 'point' || !performing) { this.previous = undefined; this.reversals = 0; this.candidate = -1; if (this.paused && !this.resumeAt) this.taps = 0; return }
    if (this.resumeAt) return
    if (!this.paused) {
      if (target !== this.candidate) { this.candidate = target; this.candidateSince = now }
      if (target >= 0 && now - this.candidateSince >= 350) { this.selected = target; this.selectedUntil = now + 1400 }
    }
    const tip = right.tip, previous = this.previous; this.previous = { ...tip }
    if (!previous) { this.anchorX = tip.x; this.anchorY = tip.y; this.directionX = this.directionY = this.reversals = 0; return }
    if (this.paused) {
      if (tip.y - this.anchorY > .025) { this.directionY = 1; this.anchorY = tip.y }
      else if (this.anchorY - tip.y > .025) {
        if (this.directionY === 1 && now - this.lastTap > 180) { this.taps++; this.lastTap = now; if (this.taps >= 2) this.resumeAt = now + 3000 }
        this.directionY = -1; this.anchorY = tip.y
      }
      if (this.lastTap && now - this.lastTap > 1500) this.taps = 0
    } else if (this.selected >= 0) {
      const direction = tip.x - this.anchorX > .025 ? 1 : this.anchorX - tip.x > .025 ? -1 : 0
      if (direction && direction !== this.directionX) {
        if (now - this.lastWag > 1000) this.reversals = 0
        if (this.directionX) this.reversals++
        this.directionX = direction; this.lastWag = now; this.anchorX = tip.x
        if (this.reversals >= 2) { this.scolded = this.selected; this.scoldUntil = now + 4500; this.reversals = 0 }
      }
    }
  }
}
