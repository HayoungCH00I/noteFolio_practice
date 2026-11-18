export type HumanMask = { width: number; height: number; data: Uint8Array }
export type Snowflake = { x: number; y: number; vx: number; vy: number; radius: number; age: number; phase: number; supported: boolean; freeUntil: number }
function distancePass(field: Float32Array, width: number, height: number) {
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x
    if (x) field[i] = Math.min(field[i]!, field[i - 1]! + 1)
    if (y) field[i] = Math.min(field[i]!, field[i - width]! + 1)
    if (x && y) field[i] = Math.min(field[i]!, field[i - width - 1]! + Math.SQRT2)
    if (x < width - 1 && y) field[i] = Math.min(field[i]!, field[i - width + 1]! + Math.SQRT2)
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x
    if (x < width - 1) field[i] = Math.min(field[i]!, field[i + 1]! + 1)
    if (y < height - 1) field[i] = Math.min(field[i]!, field[i + width]! + 1)
    if (x < width - 1 && y < height - 1) field[i] = Math.min(field[i]!, field[i + width + 1]! + Math.SQRT2)
    if (x && y < height - 1) field[i] = Math.min(field[i]!, field[i + width - 1]! + Math.SQRT2)
  }
}
export class HumanSurface {
  private mask: HumanMask
  private field: Float32Array
  private scale: number
  private offsetX: number
  private offsetY: number
  private pixel: number
  private displayWidth: number
  private displayHeight: number
  constructor(mask: HumanMask, videoWidth: number, videoHeight: number, width: number, height: number) {
    this.mask = mask
    const size = mask.width * mask.height, inside = new Float32Array(size), outside = new Float32Array(size)
    for (let i = 0; i < size; i++) { const person = mask.data[i]! > 0; inside[i] = person ? 10000 : 0; outside[i] = person ? 0 : 10000 }
    // The image border also separates the camera image from the space outside it.
    for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) if (!x || !y || x === mask.width - 1 || y === mask.height - 1) inside[y * mask.width + x] = Math.min(1, inside[y * mask.width + x]!)
    distancePass(inside, mask.width, mask.height); distancePass(outside, mask.width, mask.height)
    this.field = new Float32Array(size)
    for (let i = 0; i < size; i++) this.field[i] = mask.data[i]! > 0 ? -inside[i]! : outside[i]!
    this.scale = Math.max(width / videoWidth, height / videoHeight)
    this.offsetX = (width - videoWidth * this.scale) / 2; this.offsetY = (height - videoHeight * this.scale) / 2
    this.displayWidth = videoWidth * this.scale; this.displayHeight = videoHeight * this.scale
    this.pixel = (videoWidth / mask.width + videoHeight / mask.height) / 2 * this.scale
  }
  distance(x: number, y: number) {
    const u = (1 - (x - this.offsetX) / this.displayWidth) * this.mask.width - .5
    const v = (y - this.offsetY) / this.displayHeight * this.mask.height - .5
    if (u < 0 || v < 0 || u >= this.mask.width - 1 || v >= this.mask.height - 1) return 10000
    const ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy, i = iy * this.mask.width + ix
    return ((this.field[i]! * (1 - fx) + this.field[i + 1]! * fx) * (1 - fy) + (this.field[i + this.mask.width]! * (1 - fx) + this.field[i + this.mask.width + 1]! * fx) * fy) * this.pixel
  }
  normal(x: number, y: number) {
    const delta = Math.max(2, this.pixel)
    const dx = this.distance(x + delta, y) - this.distance(x - delta, y), dy = this.distance(x, y + delta) - this.distance(x, y - delta)
    const length = Math.hypot(dx, dy)
    return length > .001 ? { x: dx / length, y: dy / length } : { x: 0, y: -1 }
  }
}
export class SnowPhysics {
  particles: Snowflake[] = []
  surface?: HumanSurface
  time = 0
  private accumulated = 0
  private bins = new Map<number, number[]>()
  add(x: number, y: number, radius = 2 + Math.random() * 2.5, vx = (Math.random() - .5) * 20, vy = 12 + Math.random() * 20, freeFor = 0) {
    radius = Math.max(1.2, Math.min(5.5, radius))
    // shortcut: 1200 flakes and a 45s melt bound the work; raise only after device profiling.
    if (this.particles.length >= 1200) this.particles.shift()
    this.particles.push({ x, y, radius, vx, vy, age: 0, phase: Math.random() * Math.PI * 2, supported: false, freeUntil: this.time + freeFor })
  }
  step(dt: number, width: number, height: number) {
    this.accumulated += Math.min(.05, dt)
    while (this.accumulated >= 1 / 60) { this.integrate(1 / 60, width, height); this.accumulated -= 1 / 60 }
  }
  private integrate(dt: number, width: number, height: number) {
    this.time += dt
    for (const p of this.particles) {
      p.age += dt; p.supported = false
      p.vx += Math.sin(this.time * .9 + p.phase) * 7 * dt
      p.vy = Math.min(105, p.vy + 90 * dt); p.vx *= Math.exp(-.55 * dt)
      p.x += p.vx * dt; p.y += p.vy * dt
      this.collideHuman(p, dt)
    }
    for (let iteration = 0; iteration < 2; iteration++) {
      this.bins.clear()
      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i]!, x = Math.floor(p.x / 12), y = Math.floor(p.y / 12)
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const neighbors = this.bins.get((y + oy) * 16384 + x + ox)
          if (!neighbors) continue
          for (const j of neighbors) this.collidePair(p, this.particles[j]!)
        }
        const key = y * 16384 + x; const list = this.bins.get(key)
        if (list) list.push(i); else this.bins.set(key, [i])
        this.collideHuman(p, dt)
      }
    }
    let write = 0
    for (const p of this.particles) if (p.age < 45 && p.y < height + 35 && p.x > -70 && p.x < width + 70) this.particles[write++] = p
    this.particles.length = write
  }
  private collideHuman(p: Snowflake, dt: number) {
    if (!this.surface || p.freeUntil > this.time) return
    const distance = this.surface.distance(p.x, p.y)
    if (distance >= p.radius + .1) return
    const n = this.surface.normal(p.x, p.y), penetration = Math.min(80, p.radius - distance)
    p.x += n.x * penetration; p.y += n.y * penetration
    const vn = p.vx * n.x + p.vy * n.y
    if (vn < 0) { p.vx -= vn * n.x * 1.05; p.vy -= vn * n.y * 1.05 }
    const tx = -n.y, ty = n.x, tangential = p.vx * tx + p.vy * ty
    const friction = 90 * Math.max(0, -n.y) * .65 * dt
    const corrected = Math.abs(tangential) < friction ? 0 : tangential - Math.sign(tangential) * friction
    p.vx += (corrected - tangential) * tx; p.vy += (corrected - tangential) * ty
    p.supported = n.y < -.25
  }
  private collidePair(a: Snowflake, b: Snowflake) {
    const dx = a.x - b.x, dy = a.y - b.y, radius = a.radius + b.radius, d2 = dx * dx + dy * dy
    if (d2 >= radius * radius) return
    const distance = Math.sqrt(Math.max(.0001, d2)), nx = d2 < .0001 ? 0 : dx / distance, ny = d2 < .0001 ? -1 : dy / distance
    const wa = a.supported ? .12 : 1, wb = b.supported ? .12 : 1, total = wa + wb, correction = (radius - distance) * .9
    a.x += nx * correction * wa / total; a.y += ny * correction * wa / total; b.x -= nx * correction * wb / total; b.y -= ny * correction * wb / total
    const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
    if (vn < 0) {
      const impulse = -vn / total
      a.vx += nx * impulse * wa; a.vy += ny * impulse * wa; b.vx -= nx * impulse * wb; b.vy -= ny * impulse * wb
      const vt = (a.vx - b.vx) * -ny + (a.vy - b.vy) * nx, friction = Math.min(Math.abs(vt), impulse * .55) * Math.sign(vt)
      a.vx += ny * friction * wa / total; a.vy -= nx * friction * wa / total; b.vx -= ny * friction * wb / total; b.vy += nx * friction * wb / total
    }
    if (ny < -.3 && b.supported) a.supported = true
    if (ny > .3 && a.supported) b.supported = true
  }
}
