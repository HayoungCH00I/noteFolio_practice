import { isCircularPath, readChoirHand } from './choir-gestures.ts'
import { coverPoint } from './fruit-game-core.ts'
export type Point = { x: number; y: number }
export function pinchDistance(hand: Point[]) {
  if (hand.length < 21) return Infinity
  const palm = Math.hypot(hand[5]!.x - hand[17]!.x, hand[5]!.y - hand[17]!.y)
  return Math.hypot(hand[4]!.x - hand[8]!.x, hand[4]!.y - hand[8]!.y) / Math.max(palm, .001)
}
export class Dough {
  readonly size = 64
  readonly offsets = new Float32Array((this.size + 1) ** 2 * 2)
  readonly vertices = new Float32Array((this.size + 1) ** 2 * 4)
  readonly indices: Uint16Array
  constructor() {
    const indices: number[] = []
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) {
      const a = y * (this.size + 1) + x, b = a + this.size + 1
      indices.push(a, a + 1, b, a + 1, b + 1, b)
    }
    this.indices = new Uint16Array(indices)
  }
  private base(index: number): Point { return { x: (index % (this.size + 1)) / this.size * 1.8 - .9, y: Math.floor(index / (this.size + 1)) / this.size * 1.8 - .9 } }
  pull(point: Point, movement: Point) {
    for (let i = 0; i < this.offsets.length / 2; i++) {
      const base = this.base(i), x = base.x + this.offsets[i * 2]!, y = base.y + this.offsets[i * 2 + 1]!
      const t = Math.min(1, Math.hypot(x - point.x, y - point.y) / .38)
      const weight = 1 - t * t * (3 - 2 * t)
      this.offsets[i * 2] += movement.x * weight; this.offsets[i * 2 + 1] += movement.y * weight
    }
  }
  sourceAt(point: Point): Point | undefined {
    let best = .12 ** 2, result: Point | undefined
    for (let i = 0; i < this.offsets.length / 2; i++) {
      const base = this.base(i), dx = base.x + this.offsets[i * 2]! - point.x, dy = base.y + this.offsets[i * 2 + 1]! - point.y, distance = dx * dx + dy * dy
      if (distance < best) { best = distance; result = base }
    }
    return result
  }
  restore(dt: number) {
    let remaining = 0, factor = Math.exp(-7 * Math.min(dt, .05))
    for (let i = 0; i < this.offsets.length; i++) { this.offsets[i] *= factor; remaining = Math.max(remaining, Math.abs(this.offsets[i]!)) }
    if (remaining < .0001) { this.offsets.fill(0); return false }
    return true
  }
  update(center: Point, width: number, height: number) {
    for (let i = 0; i < this.offsets.length / 2; i++) {
      const p = this.base(i), j = i * 4
      this.vertices[j] = center.x + p.x * width; this.vertices[j + 1] = center.y + p.y * height
      this.vertices[j + 2] = this.vertices[j]! + this.offsets[i * 2]! * width; this.vertices[j + 3] = this.vertices[j + 1]! + this.offsets[i * 2 + 1]! * height
    }
    return this.vertices
  }
}

export function facePlacement(face: Point[], width: number, height: number) {
  const left = face[234]!, right = face[454]!, top = face[10]!, chin = face[152]!
  const dx = (right.x - left.x) * width, dy = (right.y - left.y) * height
  return { x: (top.x + chin.x) * width / 2, y: (top.y + chin.y) * height / 2, angle: Math.atan2(dy, dx), width: Math.hypot(dx, dy) * 1.12, height: Math.hypot((chin.x - top.x) * width, (chin.y - top.y) * height) * 1.08 }
}

export function faceTarget(point: Point, targets: { left: number; right: number; top: number; bottom: number }[]) {
  return targets.findIndex(rect => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom)
}

export function pointedFace(hands: Point[][], videoWidth: number, videoHeight: number, frame: { left: number; top: number; width: number; height: number }, targets: { left: number; right: number; top: number; bottom: number }[]) {
  for (const hand of hands) {
    if (readChoirHand(hand)?.pose !== 'point' || pinchDistance(hand) <= .55) continue
    const tip = coverPoint(hand[8]!, videoWidth, videoHeight, frame.width, frame.height)
    const hit = faceTarget({ x: tip.x + frame.left, y: tip.y + frame.top }, targets)
    if (hit >= 0) return hit
  }
  return -1
}

export class RubGesture {
  private path: (Point & { time: number })[] = []
  reset() { this.path = [] }
  add(hands: Point[][], face: Point[], now: number) {
    const open = hands.length === 1 ? readChoirHand(hands[0]!) : undefined
    if (open?.pose !== 'open' || face.length < 455) { this.reset(); return false }
    const p = { x: 1 - open.palm.x, y: open.palm.y }, center = face[1]!
    const width = Math.abs(face[454]!.x - face[234]!.x), height = Math.abs(face[152]!.y - face[10]!.y)
    if (Math.abs(p.x - center.x) >= width || Math.abs(p.y - center.y) >= height) { this.reset(); return false }
    const previous = this.path.at(-1)
    this.path.push({ ...p, time: now }); this.path = this.path.filter(point => now - point.time < 2000)
    return !!previous && Math.hypot(p.x - previous.x, p.y - previous.y) > .002 && isCircularPath(this.path)
  }
}
