export type BeardStyle = 0 | 1 | 2
export type BeardGrain = { x: number; y: number; radius: number; shade: number }
export const beardPatterns: BeardGrain[][] = [0, 1, 2].map(style => {
  let seed = 131 + style * 37
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  const count = style === 1 ? 320 : style === 2 ? 130 : 70
  return Array.from({ length: count }, (_, i) => {
    const t = i / count
    if (style === 0) return { x: (i % 2 ? 1 : -1) * (.047 + random() * .02), y: t * .12, radius: .012 + random() * .008, shade: random() }
    if (style === 2) return { x: (random() - .5) * .13 * (1 - t * .8), y: t * .64, radius: .015 + random() * .014, shade: random() }
    const side = (random() - .5) * 2, width = .42 * Math.sqrt(1 - t)
    return { x: side * width, y: .06 + t * .88 + Math.abs(side) * -.08, radius: .023 + random() * .021, shade: random() }
  })
})
export class SnowBeard {
  style: BeardStyle = 0
  growth = 0
  bend = 0
  lift = 0
  private vx = 0
  private vy = 0
  private cooldown = 0
  step(dt: number, snowing: boolean, faceVisible: boolean) {
    this.cooldown = Math.max(0, this.cooldown - dt)
    if (snowing && faceVisible && !this.cooldown) this.growth = Math.min(1, this.growth + dt / 12)
    this.vx += -this.bend * 32 * dt; this.vy += -this.lift * 32 * dt
    this.vx *= Math.exp(-6 * dt); this.vy *= Math.exp(-6 * dt)
    this.bend += this.vx * dt; this.lift += this.vy * dt
  }
  stroke(dx: number, dy: number, width: number) {
    if (this.growth < 1) return
    this.vx += Math.max(-3, Math.min(3, dx / width * 24)); this.vy += Math.max(-2, Math.min(2, dy / width * 18))
  }
  shakeOff() { const previous = this.growth; this.growth = 0; this.bend = this.lift = this.vx = this.vy = 0; this.cooldown = 1.5; return previous }
  choose(style: BeardStyle) { this.style = style; this.shakeOff(); this.cooldown = 0 }
}
export class HeadShake {
  private previous?: { x: number; angle: number; time: number }
  private direction = 0
  private turns = 0
  private firstTurn = 0
  sample(x: number, angle: number, now: number) {
    const previous = this.previous; this.previous = { x, angle, time: now }
    if (!previous || now - previous.time > 300) { this.direction = this.turns = 0; return false }
    const dt = Math.max(.016, (now - previous.time) / 1000), roll = Math.atan2(Math.sin(angle - previous.angle), Math.cos(angle - previous.angle)) / dt, shift = (x - previous.x) / dt
    const speed = Math.abs(roll) > 1.2 ? roll : Math.abs(shift) > 1.5 ? shift : 0
    if (!speed) return false
    const direction = Math.sign(speed)
    if (now - this.firstTurn > 900) this.turns = 0
    if (this.direction && direction !== this.direction) {
      if (!this.turns) this.firstTurn = now
      this.turns++
      if (this.turns >= 2) { this.turns = 0; this.direction = 0; return true }
    }
    this.direction = direction; return false
  }
}
