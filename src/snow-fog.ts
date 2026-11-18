import type { Point } from './fruit-game-core.ts'
export class SnowFog {
  private mask: HTMLCanvasElement
  private view: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private ratio: number
  private renderedAt = -Infinity
  amount = 0
  constructor(width: number, height: number) {
    this.mask = document.createElement('canvas'); this.view = document.createElement('canvas')
    this.ratio = Math.min(.5, 960 / width)
    this.mask.width = this.view.width = Math.max(1, Math.round(width * this.ratio)); this.mask.height = this.view.height = Math.max(1, Math.round(height * this.ratio))
    this.ctx = this.mask.getContext('2d')!
  }
  breath(x: number, y: number, faceWidth: number) {
    const ctx = this.ctx, r = Math.max(22, faceWidth * .65) * this.ratio
    ctx.save(); ctx.translate(x * this.ratio, y * this.ratio); ctx.scale(1.4, .9)
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r); gradient.addColorStop(0, '#ffffff30'); gradient.addColorStop(.5, '#ffffff1c'); gradient.addColorStop(1, '#ffffff00')
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore()
    this.amount = Math.min(1, this.amount + .13); this.renderedAt = -Infinity
  }
  wipe(from: Point, to: Point, radius = 19) {
    const ctx = this.ctx; ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = radius * 2 * this.ratio; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(from.x * this.ratio, from.y * this.ratio); ctx.lineTo(to.x * this.ratio, to.y * this.ratio); ctx.stroke()
    ctx.beginPath(); ctx.arc(to.x * this.ratio, to.y * this.ratio, radius * this.ratio, 0, Math.PI * 2); ctx.fill(); ctx.restore(); this.renderedAt = -Infinity
  }
  step(dt: number) {
    if (this.amount < .004) { if (this.amount) this.clear(); return }
    const fade = 1 - Math.exp(-dt / 7)
    this.ctx.save(); this.ctx.globalCompositeOperation = 'destination-out'; this.ctx.fillStyle = `rgba(0,0,0,${fade})`; this.ctx.fillRect(0, 0, this.mask.width, this.mask.height); this.ctx.restore()
    this.amount *= 1 - fade
  }
  image(video: HTMLVideoElement, now: number) {
    if (now - this.renderedAt < 65 || video.readyState < 2) return this.view
    this.renderedAt = now
    const ctx = this.view.getContext('2d')!, width = this.view.width, height = this.view.height
    const scale = Math.max(width / video.videoWidth, height / video.videoHeight), vw = video.videoWidth * scale, vh = video.videoHeight * scale
    ctx.clearRect(0, 0, width, height); ctx.save(); ctx.filter = 'blur(6px)'; ctx.translate(width, 0); ctx.scale(-1, 1); ctx.drawImage(video, (width - vw) / 2, (height - vh) / 2, vw, vh); ctx.restore()
    ctx.fillStyle = '#f2fbff99'; ctx.fillRect(0, 0, width, height)
    ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(this.mask, 0, 0); ctx.globalCompositeOperation = 'source-over'
    return this.view
  }
  clear() { this.ctx.clearRect(0, 0, this.mask.width, this.mask.height); this.amount = 0; this.renderedAt = -Infinity }
}
