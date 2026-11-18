import type { Point } from './gestures.ts'
import { drawCommuter } from './commuter.ts'

type FlyerKind = 'pigeon' | 'commuter'

interface Pigeon extends Point {
  kind: FlyerKind; reducedMotion: boolean
  vx: number; vy: number; age: number; life: number; size: number; phase: number; shade: number
}

/** Daytime cast: nine pigeons and one commuter per shuffled group of ten. */
export class Pigeons {
  private birds: Pigeon[] = []
  private cast: FlyerKind[] = []

  private nextKind(): FlyerKind {
    if (this.cast.length === 0) {
      this.cast = [...Array<FlyerKind>(9).fill('pigeon'), 'commuter']
      for (let i = this.cast.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const item = this.cast[i]!
        this.cast[i] = this.cast[j]!
        this.cast[j] = item
      }
    }
    return this.cast.pop()!
  }
  clear() { this.birds = [] }

  release(x: number, y: number, strength: number, reducedMotion: boolean) {
    const count = Math.round(3 + strength * 3)
    for (let i = 0; i < count; i++) {
      this.birds.push({
        kind: this.nextKind(), reducedMotion,
        x: x + (Math.random() - 0.5) * 15, y: y + (Math.random() - 0.5) * 12,
        vx: (Math.random() < 0.5 ? -1 : 1) * (25 + Math.random() * 75),
        vy: -(45 + Math.random() * 55), age: 0,
        life: reducedMotion ? 1.8 : 3.8 + Math.random() * 1.6,
        size: (0.65 + Math.random() * 0.35) * (0.8 + strength * 0.3),
        phase: Math.random() * Math.PI * 2, shade: Math.random(),
      })
    }
    this.birds = this.birds.slice(-180)
  }

  draw(ctx: CanvasRenderingContext2D, dt: number) {
    for (const bird of this.birds) {
      bird.age += dt
      bird.x += bird.vx * dt
      bird.y += bird.vy * dt
      bird.vy -= 6 * dt
      const flap = Math.sin(bird.age * 15 + bird.phase)
      ctx.save()
      ctx.globalAlpha = Math.min(1, bird.age * 12, Math.max(0, (bird.life - bird.age) * 1.6))
      ctx.translate(bird.x, bird.y)
      if (bird.kind === 'commuter') {
        // Keep the frontal pose unmirrored so the case stays in his right hand.
        ctx.scale(bird.size, bird.size)
        drawCommuter(ctx, bird.age, bird.phase, Math.sign(bird.vx), bird.reducedMotion)
        ctx.restore()
        continue
      }
      ctx.scale(bird.size * Math.sign(bird.vx), bird.size)
      ctx.rotate(-0.12 + Math.sin(bird.age * 2 + bird.phase) * 0.06)
      // Far wing, tapered tail, and plump grey body.
      ctx.fillStyle = '#8994a3'
      ctx.beginPath()
      ctx.moveTo(-2, 0)
      ctx.quadraticCurveTo(-17, -18 * flap - 8, -22, -23 * flap - 5)
      ctx.quadraticCurveTo(-3, -12 * flap - 4, 7, 0)
      ctx.fill()
      ctx.fillStyle = '#647080'
      ctx.beginPath()
      ctx.moveTo(-7, 0); ctx.lineTo(-23, 1); ctx.lineTo(-20, 6); ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill()
      ctx.fillStyle = bird.shade > 0.5 ? '#bac3cd' : '#a3afbd'
      ctx.beginPath(); ctx.ellipse(0, 1, 13, 7, -0.15, 0, Math.PI * 2); ctx.fill()
      // Iridescent neck, head, bright beak, and eye distinguish pigeons from silhouettes.
      ctx.fillStyle = '#5b8e8d'
      ctx.beginPath(); ctx.ellipse(9, -3, 5, 7, 0.35, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#8493a5'
      ctx.beginPath(); ctx.arc(12, -9, 5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#d8b896'
      ctx.beginPath(); ctx.moveTo(16, -10); ctx.lineTo(22, -8); ctx.lineTo(16, -6); ctx.closePath(); ctx.fill()
      ctx.fillStyle = '#233143'
      ctx.beginPath(); ctx.arc(14, -10, 1.1, 0, Math.PI * 2); ctx.fill()
      // Near wing opens and folds; two dark bars echo real pigeon feathers.
      ctx.fillStyle = '#d1d8df'
      ctx.beginPath()
      ctx.moveTo(4, 0)
      ctx.quadraticCurveTo(-4, -16 * flap - 5, -16, -28 * flap - 2)
      ctx.quadraticCurveTo(-22, -18 * flap + 4, -9, 6)
      ctx.closePath(); ctx.fill()
      ctx.strokeStyle = '#6d7b8d'; ctx.lineWidth = 1.8
      for (const offset of [0, 4]) {
        ctx.beginPath(); ctx.moveTo(-9 - offset, -15 * flap); ctx.lineTo(-5 - offset, 3 - offset * 0.4); ctx.stroke()
      }
      ctx.restore()
    }
    this.birds = this.birds.filter((bird) => bird.age < bird.life)
  }
}
