import type { Point } from './gestures.ts'

export const snackKinds = ['chicken', 'pizza', 'tteokbokki', 'ramen', 'jajang', 'jokbal'] as const
export type SnackKind = typeof snackKinds[number]
export const chooseSnack = (): SnackKind => snackKinds[Math.floor(Math.random() * snackKinds.length)]!

interface Snack extends Point {
  kind: SnackKind; age: number; life: number; size: number; phase: number; vx: number; vy: number
}

function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, rotation = 0) {
  ctx.fillStyle = color
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2); ctx.fill()
}
function stroke(ctx: CanvasRenderingContext2D, color: string, width: number, draw: () => void) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); draw(); ctx.stroke()
}
function garnish(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#62a352'
  for (let i = 0; i < 8; i++) {
    const x = Math.sin(i * 5.3) * 20
    const y = Math.cos(i * 3.7) * 14
    ctx.save(); ctx.translate(x, y); ctx.rotate(i * 1.9); ctx.fillRect(-2, -1, 4, 2); ctx.restore()
  }
}

/** Every illustration is one complete serving inside a single bowl or plate. */
export function drawSnack(ctx: CanvasRenderingContext2D, kind: SnackKind, age: number) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // Bowl base, ceramic rim, and recessed center.
  oval(ctx, 0, 7, 35, 25, '#a7b3c8')
  oval(ctx, 0, 1, 38, 27, '#f1ede3')
  oval(ctx, 0, -1, 33, 22, '#d8d1c5')

  if (kind === 'chicken') {
    oval(ctx, 0, -1, 31, 20, '#eee4d1')
    for (let i = 0; i < 6; i++) {
      const x = Math.sin(i * 2.5) * 21
      const y = Math.cos(i * 2.5) * 11 - 2
      ctx.save(); ctx.translate(x, y); ctx.rotate(i * 1.4)
      stroke(ctx, '#f4e7cb', 5, () => { ctx.moveTo(4, 1); ctx.lineTo(15, 1) })
      oval(ctx, 15, -1, 2.8, 2.8, '#fff0d4'); oval(ctx, 15, 3, 2.8, 2.8, '#fff0d4')
      oval(ctx, -2, 0, 11, 8, '#a95a22')
      oval(ctx, -3, -2, 10, 7, '#dc983a')
      for (let crumb = 0; crumb < 8; crumb++) oval(ctx, Math.sin(crumb * 4) * 7 - 3, Math.cos(crumb * 2) * 4 - 2, 1.3, 1, crumb % 2 ? '#f0bc62' : '#b67028')
      ctx.restore()
    }
  } else if (kind === 'pizza') {
    oval(ctx, 0, -1, 31, 21, '#b96d32')
    oval(ctx, 0, -2, 29, 19, '#edb766')
    oval(ctx, 0, -2, 25, 16, '#bc4529')
    oval(ctx, 0, -2, 23, 15, '#f1cd6d')
    for (let i = 0; i < 7; i++) {
      const x = Math.sin(i * 2.4) * 17
      const y = Math.cos(i * 2.4) * 10 - 2
      oval(ctx, x, y, 4.6, 3.5, '#b94d34')
      oval(ctx, x - 1, y - 1, 1.2, 0.8, '#e77c4b')
    }
    stroke(ctx, '#b97c40', 0.8, () => {
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.moveTo(0, -2); ctx.lineTo(Math.cos(a) * 27, Math.sin(a) * 17 - 2) }
    })
    garnish(ctx)
  } else if (kind === 'tteokbokki') {
    oval(ctx, 0, -1, 31, 20, '#9d3020')
    oval(ctx, -2, -3, 29, 17, '#d44827')
    for (let i = 0; i < 12; i++) {
      ctx.save(); ctx.translate(Math.sin(i * 2.4) * 23, Math.cos(i * 2.7) * 12 - 2); ctx.rotate(i * 1.6)
      ctx.fillStyle = '#ed8750'; ctx.beginPath(); ctx.roundRect(-8, -3, 16, 6, 3); ctx.fill()
      stroke(ctx, '#ffba7d', 1.3, () => { ctx.moveTo(-4, -1); ctx.lineTo(4, -1) })
      ctx.restore()
    }
    oval(ctx, 12, -7, 8, 6, '#fff3c7', -0.3)
    oval(ctx, 12, -7, 3.5, 3, '#efb82d')
    garnish(ctx)
  } else if (kind === 'ramen' || kind === 'jajang') {
    const ramen = kind === 'ramen'
    oval(ctx, 0, -1, 31, 21, ramen ? '#b4542a' : '#443026')
    // A continuous tangle makes the noodles read as one full bowl.
    stroke(ctx, ramen ? '#f1c361' : '#a97a3e', 2, () => {
      for (let i = 0; i < 14; i++) {
        const y = -16 + i * 2.2
        const width = Math.sqrt(Math.max(0, 1 - ((y + 1) / 20) ** 2)) * 27
        ctx.moveTo(-width, y)
        ctx.bezierCurveTo(-width * 0.3, y - 7, width * 0.3, y + 7, width, y)
      }
    })
    if (ramen) {
      oval(ctx, 11, -7, 10, 7, '#fff5d3', -0.4)
      oval(ctx, 11, -7, 4.5, 4, '#edaa27')
      ctx.fillStyle = '#375443'; ctx.save(); ctx.translate(-15, -10); ctx.rotate(-0.3); ctx.fillRect(-5, -5, 10, 11); ctx.restore()
      garnish(ctx)
    } else {
      for (let i = 0; i < 13; i++) {
        ctx.fillStyle = i % 3 ? '#36261f' : '#76513b'
        ctx.fillRect(Math.sin(i * 2.5) * 23 - 2, Math.cos(i * 2.4) * 13 - 3, 5, 4)
      }
      stroke(ctx, '#72a561', 2, () => {
        for (let i = 0; i < 5; i++) { ctx.moveTo(-7 + i * 2, -9); ctx.lineTo(2 + i * 2, 2) }
      })
    }
  } else {
    oval(ctx, 0, -1, 31, 20, '#60854c')
    for (let i = 0; i < 7; i++) oval(ctx, Math.sin(i * 2.4) * 22, Math.cos(i * 2.4) * 12 - 1, 10, 7, i % 2 ? '#6d9857' : '#477748', i)
    for (let i = 0; i < 7; i++) {
      const x = -20 + i * 6
      const y = Math.sin(i * 0.7) * 5 - 3
      oval(ctx, x, y, 7, 12, '#71402a', -0.35)
      oval(ctx, x - 0.7, y - 1, 5.5, 9.5, '#d19778', -0.35)
      oval(ctx, x - 1, y - 1.5, 3, 7, '#b7775e', -0.35)
      oval(ctx, x, y + 2, 1.5, 2.5, '#eed1ab', -0.35)
    }
    ctx.fillStyle = '#ead5a2'
    for (let i = 0; i < 14; i++) { ctx.save(); ctx.translate(Math.sin(i * 4) * 21, Math.cos(i * 2.4) * 12); ctx.rotate(i); ctx.fillRect(0, 0, 2, 1); ctx.restore() }
  }

  // Gentle steam stays attached to the serving; no separate food particles.
  if (kind === 'ramen' || kind === 'tteokbokki' || kind === 'jajang') {
    ctx.save(); ctx.globalAlpha *= 0.38
    stroke(ctx, '#fff3df', 1.3, () => {
      for (const x of [-10, 3, 15]) {
        const wave = Math.sin(age * 2 + x) * 3
        ctx.moveTo(x, -24); ctx.bezierCurveTo(x - 6 + wave, -30, x + 6 + wave, -34, x, -41)
      }
    })
    ctx.restore()
  }
}

export class NightSnacks {
  private servings: Snack[] = []
  private cast: boolean[] = []

  /** Keep the 9:1 ratio across clicks, drags, clearing and scene changes. */
  nextIsSnack(): boolean {
    if (this.cast.length === 0) {
      this.cast = [...Array<boolean>(9).fill(false), true]
      for (let i = this.cast.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const value = this.cast[i]!
        this.cast[i] = this.cast[j]!
        this.cast[j] = value
      }
    }
    return this.cast.pop()!
  }

  clear() { this.servings = [] }

  serve(x: number, y: number, strength: number, kind: SnackKind, reducedMotion: boolean) {
    this.servings.push({ x, y, kind, age: 0, life: reducedMotion ? 1.8 : 3.8,
      size: 0.8 + strength * 0.3, phase: Math.random() * Math.PI * 2,
      vx: reducedMotion ? 0 : (Math.random() - 0.5) * 16, vy: reducedMotion ? -8 : -24,
    })
    this.servings = this.servings.slice(-40)
  }

  draw(ctx: CanvasRenderingContext2D, dt: number) {
    for (const snack of this.servings) {
      snack.age += dt; snack.x += snack.vx * dt; snack.y += snack.vy * dt
      const appear = Math.min(1, snack.age / 0.22)
      const scale = snack.size * (0.75 + 0.25 * (1 - (1 - appear) ** 3))
      ctx.save()
      ctx.globalAlpha = Math.min(appear, Math.max(0, (snack.life - snack.age) / 0.7))
      ctx.translate(snack.x, snack.y)
      ctx.scale(scale, scale)
      ctx.rotate(Math.sin(snack.age * 1.8 + snack.phase) * 0.08)
      ctx.shadowColor = '#ffd49455'; ctx.shadowBlur = 16
      oval(ctx, 0, 6, 35, 24, '#ffe1ac33')
      ctx.shadowBlur = 0
      drawSnack(ctx, snack.kind, snack.age)
      ctx.restore()
    }
    this.servings = this.servings.filter((snack) => snack.age < snack.life)
  }
}
