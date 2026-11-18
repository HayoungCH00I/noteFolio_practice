export interface Point { x: number; y: number }

export function chargeStrength(duration: number): number {
  return 0.7 + Math.min(Math.max(duration, 0) / 3200, 1) * 1.7
}

/** Equal-distance samples preserve turns, endpoints and drawing order. */
export function samplePath(points: Point[], spacing = 35, limit = 36): Point[] {
  if (points.length < 2) return points.slice()
  const distances = [0]
  for (let i = 1; i < points.length; i++) {
    distances.push(distances[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y))
  }
  const total = distances[distances.length - 1]!
  if (total < 1) return [points[points.length - 1]!]
  const count = Math.min(limit, Math.max(2, Math.ceil(total / spacing) + 1))
  let segment = 1
  return Array.from({ length: count }, (_, index) => {
    const target = total * index / (count - 1)
    while (segment < points.length - 1 && distances[segment]! < target) segment++
    const start = points[segment - 1]!
    const end = points[segment]!
    const length = distances[segment]! - distances[segment - 1]!
    const ratio = length > 0 ? (target - distances[segment - 1]!) / length : 0
    return { x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio }
  })
}

/** Recognize several fast direction changes, rather than a single quick swipe. */
export class StirDetector {
  private samples: Array<Point & { time: number }> = []

  reset() { this.samples = [] }

  add(point: Point, time: number): boolean {
    const previous = this.samples[this.samples.length - 1]
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 4) return false
    this.samples.push({ ...point, time })
    this.samples = this.samples.filter((sample) => time - sample.time <= 1100).slice(-200)
    if (this.samples.length < 5) return false
    let horizontal = 0
    let vertical = 0
    let distance = 0
    for (let i = 1; i < this.samples.length; i++) {
      const a = this.samples[i - 1]!
      const b = this.samples[i]!
      horizontal += Math.abs(b.x - a.x)
      vertical += Math.abs(b.y - a.y)
      distance += Math.hypot(b.x - a.x, b.y - a.y)
    }
    const axis = horizontal >= vertical ? 'x' : 'y'
    let extreme = this.samples[0]![axis]
    let direction = 0
    let turns = 0
    for (const sample of this.samples) {
      const value = sample[axis]
      if (direction === 0) {
        if (Math.abs(value - extreme) >= 28) { direction = Math.sign(value - extreme); extreme = value }
      } else if ((value - extreme) * direction > 0) {
        extreme = value
      } else if ((extreme - value) * direction >= 32) {
        turns++
        direction *= -1
        extreme = value
      }
    }
    const elapsed = Math.max(1, time - this.samples[0]!.time)
    if (turns >= 3 && distance >= 520 && distance / elapsed * 1000 >= 900) {
      this.reset()
      return true
    }
    return false
  }
}

/** Normalize rapid wheel and trackpad input into a scene-change gesture. */
export class ScrollRushDetector {
  private samples: Array<{ distance: number; time: number }> = []
  reset() { this.samples = [] }

  add(deltaX: number, deltaY: number, deltaMode: number, time: number, pageHeight: number): boolean {
    const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? pageHeight : 1
    const distance = Math.min(350, Math.hypot(deltaX, deltaY) * unit)
    if (!Number.isFinite(distance) || distance < 2) return false
    this.samples.push({ distance, time })
    this.samples = this.samples.filter((sample) => time - sample.time <= 600).slice(-100)
    const total = this.samples.reduce((sum, sample) => sum + sample.distance, 0)
    if (this.samples.length >= 3 && total >= 650) {
      this.reset()
      return true
    }
    return false
  }
}
