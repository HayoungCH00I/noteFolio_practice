import type { FruitKind } from './fruit-game-core.ts'
export function drawFruit(ctx: CanvasRenderingContext2D, kind: FruitKind, radius: number, inside = false) {
  ctx.save(); ctx.scale(radius, radius); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  const ellipse = (x: number, y: number, rx: number, ry: number, color: string) => { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill() }
  const gradient = (light: string, dark: string) => { const g = ctx.createRadialGradient(-.3, -.4, .1, 0, 0, 1.2); g.addColorStop(0, light); g.addColorStop(1, dark); return g }
  const body = (color: string | CanvasGradient, path?: () => void) => { ctx.fillStyle = color; ctx.beginPath(); if (path) path(); else ctx.arc(0, 0, .95, 0, Math.PI * 2); ctx.fill() }
  if (kind === 'watermelon') {
    body(gradient('#9fdc76', '#29663d'))
    for (let i = -2; i <= 2; i++) { ctx.strokeStyle = '#235d38a0'; ctx.lineWidth = .08; ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(i) * .2 + .12, .92, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke() }
    if (inside) { ellipse(0, 0, .85, .85, '#ecf0ab'); ellipse(0, 0, .76, .76, '#f25c6b'); for (let i = 0; i < 13; i++) { const a = i * 2.4; ellipse(Math.cos(a) * (.28 + i % 3 * .13), Math.sin(a) * (.28 + i % 3 * .13), .035, .065, '#362d38') } }
  } else if (kind === 'peach') {
    body(gradient('#ffd0ae', '#ee6483'), () => { ctx.moveTo(0, -.7); ctx.bezierCurveTo(-1.1, -1.25, -1.4, .55, 0, 1); ctx.bezierCurveTo(1.4, .55, 1.1, -1.25, 0, -.7) })
    if (inside) { ellipse(0, .05, .73, .75, '#ffd79e'); ellipse(0, .08, .23, .33, '#9b5334') }
    else { ctx.strokeStyle = '#d9607290'; ctx.lineWidth = .025; ctx.beginPath(); ctx.moveTo(0, -.58); ctx.quadraticCurveTo(-.2, .2, 0, .85); ctx.stroke() }
  } else if (kind === 'apple') {
    body(gradient('#ff9c79', '#ba2846'), () => { ctx.moveTo(0, -.7); ctx.bezierCurveTo(-1.15, -1.3, -1.2, .65, -.3, .95); ctx.quadraticCurveTo(0, .8, .3, .95); ctx.bezierCurveTo(1.2, .65, 1.15, -1.3, 0, -.7) })
    if (inside) { ellipse(0, .05, .74, .78, '#fff1cb'); ellipse(-.12, .08, .045, .09, '#6d4236'); ellipse(.12, .08, .045, .09, '#6d4236') }
  } else if (kind === 'avocado') {
    body(gradient('#8fc759', '#315a2e'), () => { ctx.moveTo(0, -1.05); ctx.bezierCurveTo(-.55, -1.05, -.52, -.42, -.8, .12); ctx.bezierCurveTo(-1.25, 1.35, 1.25, 1.35, .8, .12); ctx.bezierCurveTo(.52, -.42, .55, -1.05, 0, -1.05) })
    if (inside) { ellipse(0, .1, .69, .84, '#d7df86'); ellipse(0, .24, .35, .38, '#97613e'); ellipse(-.09, .16, .12, .12, '#b87e4c') }
    else for (let i = 0; i < 35; i++) ellipse(Math.sin(i * 13) * .6, Math.cos(i * 7) * .7, .025, .03, '#254c2c50')
  } else if (kind === 'pineapple') {
    for (let i = -2; i <= 2; i++) { ctx.fillStyle = i % 2 ? '#3e9565' : '#6db875'; ctx.beginPath(); ctx.moveTo(i * .12, -.6); ctx.lineTo(i * .3, -1.55 + Math.abs(i) * .14); ctx.lineTo(i * .12 + .16, -.65); ctx.fill() }
    body(gradient('#ffe176', '#d68e2b'), () => ctx.ellipse(0, .12, .72, .9, 0, 0, Math.PI * 2))
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, .12, .72, .9, 0, 0, Math.PI * 2); ctx.clip(); ctx.strokeStyle = '#a8762d70'; ctx.lineWidth = .025
    for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(-1, i * .3 - 1); ctx.lineTo(1, i * .3 + 1); ctx.moveTo(-1, i * .3 + 1); ctx.lineTo(1, i * .3 - 1); ctx.stroke() }; ctx.restore()
    if (inside) { ellipse(0, .1, .61, .78, '#ffe69a'); ellipse(0, .1, .13, .6, '#fff5c5') }
  } else {
    ctx.strokeStyle = '#c69b63'; ctx.lineWidth = .1; ctx.beginPath(); ctx.moveTo(.25, -.8); ctx.quadraticCurveTo(.2, -1.35, .62, -1.17); ctx.stroke()
    ellipse(.63, -1.17, .11, .11, '#ffd778'); ellipse(.63, -1.17, .055, .055, '#ff755a')
    body(gradient('#656775', '#171823'))
    ctx.fillStyle = '#ff806d'; ctx.font = 'bold .65px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', 0, .08)
  }
  if (['peach', 'apple'].includes(kind)) {
    ctx.strokeStyle = '#80583c'; ctx.lineWidth = .09; ctx.beginPath(); ctx.moveTo(0, -.72); ctx.lineTo(.06, -1.04); ctx.stroke()
    ctx.fillStyle = '#609b60'; ctx.beginPath(); ctx.ellipse(.28, -.89, .26, .11, -.45, 0, Math.PI * 2); ctx.fill()
  }
  if (!inside) { ctx.save(); ctx.globalAlpha = .25; ellipse(-.34, -.38, .14, .25, '#fff'); ctx.restore() }
  ctx.restore()
}
