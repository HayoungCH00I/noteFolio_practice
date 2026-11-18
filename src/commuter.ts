interface Joint { x: number; y: number }
const bend = (start: Joint, angle: number, length: number): Joint => ({
  x: start.x + Math.sin(angle) * length,
  y: start.y + Math.cos(angle) * length,
})

function line(ctx: CanvasRenderingContext2D, points: Joint[], color: string, width: number) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(points[0]!.x, points[0]!.y)
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y)
  ctx.stroke()
}

/** Front-facing commuter: his anatomical right hand is on the viewer's left. */
export function drawCommuter(ctx: CanvasRenderingContext2D, age: number, phase: number, direction: number, reducedMotion: boolean) {
  const t = age * (reducedMotion ? 5 : 13) + phase
  const swing = reducedMotion ? 0.45 : 1
  ctx.save()
  ctx.scale(1.15, 1.15)
  ctx.rotate(direction * 0.16 + Math.sin(t * 0.65) * 0.13 * swing)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Black suit trousers, independently kicking knees, and polished dress shoes.
  for (const side of [-1, 1]) {
    const hip = { x: side * 5, y: 16 }
    const angle = side * 0.4 + Math.sin(t * (side < 0 ? 0.9 : 1.13) + side) * 1.15 * swing
    const knee = bend(hip, angle, 17)
    const ankle = bend(knee, angle + Math.sin(t * 1.3 + side * 2) * 1.15 * swing, 15)
    line(ctx, [hip, knee, ankle], '#23252d', 8)
    line(ctx, [{ x: hip.x + 1, y: hip.y + 3 }, { x: knee.x + 1, y: knee.y }], '#41434c', 1)
    ctx.save()
    ctx.translate(ankle.x, ankle.y)
    ctx.rotate(-side * 0.3 + Math.sin(t + side) * 0.35 * swing)
    ctx.fillStyle = '#12151d'
    ctx.beginPath(); ctx.roundRect(-5, -1, 14, 7, 3); ctx.fill()
    line(ctx, [{ x: -3, y: 1 }, { x: 5, y: 1 }], '#647081', 1)
    ctx.restore()
  }

  const drawArm = (side: number): Joint => {
    const shoulder = { x: side * 10, y: -5 }
    const angle = side * 1.4 + Math.sin(t * (side < 0 ? 1.07 : 1.23) + side) * 1.1 * swing
    const elbow = bend(shoulder, angle, 15)
    const wrist = bend(elbow, angle + Math.sin(t * 1.4 - side) * 1.5 * swing, 13)
    line(ctx, [shoulder, elbow, wrist], '#bec9d3', 9)
    line(ctx, [shoulder, elbow, wrist], '#fcfcf7', 7)
    ctx.fillStyle = '#efbf9c'
    ctx.beginPath(); ctx.ellipse(wrist.x, wrist.y, 3.6, 4.1, 0, 0, Math.PI * 2); ctx.fill()
    return wrist
  }
  drawArm(1)

  // White button-up shirt, collar, tucked waist, and visible belt buckle.
  ctx.fillStyle = '#fdfdf8'
  ctx.strokeStyle = '#bec9d3'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(-12, -10, 24, 30, 5); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#efbf9c'
  ctx.fillRect(-4, -14, 8, 8)
  ctx.fillStyle = '#e1e8ed'
  ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(-1, -5); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill()
  ctx.beginPath(); ctx.moveTo(8, -10); ctx.lineTo(1, -5); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill()
  line(ctx, [{ x: 0, y: -4 }, { x: 0, y: 15 }], '#d3dbe1', 0.8)
  for (const y of [1, 7, 13]) {
    ctx.fillStyle = '#8a97a4'; ctx.beginPath(); ctx.arc(0.8, y, 0.8, 0, Math.PI * 2); ctx.fill()
  }
  ctx.strokeStyle = '#c6d0d9'; ctx.lineWidth = 0.7; ctx.strokeRect(5, 1, 5, 5)
  ctx.fillStyle = '#181c24'; ctx.fillRect(-12, 16, 24, 4)
  ctx.fillStyle = '#b4bac3'; ctx.fillRect(-2.8, 15.8, 5.6, 4.4)
  ctx.fillStyle = '#30353e'; ctx.fillRect(-1.5, 17, 3, 2)

  // Bald crown and side hair, with exactly one curved strand on top.
  ctx.fillStyle = '#e6ad8d'
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(side * 13, -24, 2.8, 4, 0, 0, Math.PI * 2); ctx.fill()
  }
  ctx.fillStyle = '#f2c5a3'
  ctx.beginPath(); ctx.ellipse(0, -25, 13, 15, 0, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#ffe0bb'
  ctx.beginPath(); ctx.ellipse(-3.5, -34, 5, 2.3, -0.25, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#68707a'
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(side * 11.7, -25, 1.9, 5.5, side * 0.13, 0, Math.PI * 2); ctx.fill()
  }
  ctx.strokeStyle = '#383c44'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(0, -39); ctx.bezierCurveTo(-4, -44, 4, -48, 1, -49); ctx.stroke()

  // Knitted brows, narrowed eyes, forehead creases, and a deep frown.
  line(ctx, [{ x: -8, y: -29 }, { x: -3, y: -26.5 }], '#4d4342', 2.2)
  line(ctx, [{ x: 3, y: -26.5 }, { x: 8, y: -29 }], '#4d4342', 2.2)
  line(ctx, [{ x: -7, y: -24.5 }, { x: -3.5, y: -24 }], '#302e34', 1.5)
  line(ctx, [{ x: 3.5, y: -24 }, { x: 7, y: -24.5 }], '#302e34', 1.5)
  ctx.strokeStyle = '#bc816d'; ctx.lineWidth = 0.8
  ctx.beginPath(); ctx.moveTo(-5, -33); ctx.quadraticCurveTo(0, -34.5, 5, -33); ctx.stroke()
  line(ctx, [{ x: -1.2, y: -31 }, { x: -0.6, y: -28.5 }], '#bc816d', 0.7)
  line(ctx, [{ x: 1.2, y: -31 }, { x: 0.6, y: -28.5 }], '#bc816d', 0.7)
  line(ctx, [{ x: 0, y: -23 }, { x: 2, y: -19 }, { x: -0.5, y: -18 }], '#c48d75', 1)
  ctx.strokeStyle = '#825647'; ctx.lineWidth = 1.7
  ctx.beginPath(); ctx.moveTo(-6, -13); ctx.quadraticCurveTo(0, -18, 6, -13); ctx.stroke()

  // The briefcase is anchored to the right wrist on every animation frame.
  const hand = drawArm(-1)
  ctx.save()
  ctx.translate(hand.x, hand.y)
  ctx.rotate(Math.sin(t * 0.9) * 0.55 * swing)
  ctx.strokeStyle = '#29272b'; ctx.lineWidth = 2.5
  ctx.beginPath(); ctx.roundRect(-5, 0, 10, 8, 2); ctx.stroke()
  ctx.fillStyle = '#443a35'; ctx.strokeStyle = '#29272b'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.roundRect(-12, 5, 25, 18, 2.5); ctx.fill(); ctx.stroke()
  line(ctx, [{ x: -10, y: 12 }, { x: 11, y: 12 }], '#77604e', 1)
  ctx.fillStyle = '#c2a46a'; ctx.fillRect(-1, 10, 3, 4)
  ctx.restore()
  ctx.restore()
}
