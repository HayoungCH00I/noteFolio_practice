import { PopAudio } from './pop-audio.ts'
import type { Point } from './gestures.ts'
import { createBubbleLayout, bubbleArtwork, shapeNames, colorNames } from './bubble-art.ts'
import type { BubbleAppearance } from './bubble-art.ts'

export function bubbleInflation(now: number, poppedAt: number, hold: number, duration: number): number {
  const t = Math.min(1, Math.max(0, (now - poppedAt - hold) / duration))
  return t * t * (3 - 2 * t)
}

/** Sample the whole swipe so fast drags cannot skip intervening bubbles. */
export function swipePoints(from: Point, to: Point, spacing: number): Point[] {
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / spacing))
  return Array.from({ length: steps }, (_, i) => {
    const t = (i + 1) / steps
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
  })
}

interface Bubble {
  appearance: BubbleAppearance; element: HTMLButtonElement; poppedAt: number | null; hold: number; duration: number
}

export class BubbleWrap {
  private root: HTMLElement
  private field: HTMLElement
  private counter: HTMLElement
  private soundButton: HTMLButtonElement
  private audio = new PopAudio()
  private bubbles: Bubble[] = []
  private healing = new Set<number>()
  private pointers = new Map<number, Point>()
  private active = false
  private frame = 0
  private columns = 0
  private rows = 0
  private cellSize = 60
  private focused = 0
  private total = 0

  constructor(root: HTMLElement) {
    this.root = root
    this.field = root.querySelector<HTMLElement>('.bubble-field')!
    this.counter = root.querySelector<HTMLElement>('#pop-count')!
    this.soundButton = root.querySelector<HTMLButtonElement>('#bubble-sound')!
    this.soundButton.addEventListener('click', () => {
      const muted = this.audio.toggle()
      this.soundButton.setAttribute('aria-pressed', String(!muted))
      this.soundButton.textContent = muted ? '소리 꺼짐 ◌' : '소리 켜짐 ♪'
    })
    this.field.addEventListener('pointerdown', (event) => {
      if (!this.active || event.button !== 0) return
      event.preventDefault()
      this.audio.unlock()
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      this.field.setPointerCapture(event.pointerId)
      const button = (event.target as Element).closest<HTMLButtonElement>('.bubble')
      if (button) {
        this.focusBubble(Number(button.dataset.index), false)
        this.pop(Number(button.dataset.index))
      }
    })
    this.field.addEventListener('pointermove', (event) => {
      if (!this.active || !this.pointers.has(event.pointerId)) return
      event.preventDefault()
      const coalesced = event.getCoalescedEvents?.() ?? []
      for (const point of coalesced.length ? coalesced : [event]) this.drag(event.pointerId, { x: point.clientX, y: point.clientY })
    })
    this.field.addEventListener('pointerup', (event) => {
      if (this.pointers.has(event.pointerId)) this.drag(event.pointerId, { x: event.clientX, y: event.clientY })
      this.endPointer(event.pointerId)
    })
    this.field.addEventListener('pointercancel', (event) => this.endPointer(event.pointerId))
    this.field.addEventListener('lostpointercapture', (event) => this.pointers.delete(event.pointerId))
    this.field.addEventListener('contextmenu', (event) => event.preventDefault())
    // Native button activation covers keyboard and assistive technology clicks.
    this.field.addEventListener('click', (event) => {
      if (event.detail !== 0) return
      const button = (event.target as Element).closest<HTMLButtonElement>('.bubble')
      if (button) this.pop(Number(button.dataset.index))
    })
    this.field.addEventListener('focusin', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('.bubble')
      if (button) this.focusBubble(Number(button.dataset.index), false)
    })
    this.field.addEventListener('keydown', (event) => {
      const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -this.columns, ArrowDown: this.columns, Home: -this.focused, End: this.bubbles.length - 1 - this.focused }
      if (!(event.key in moves)) return
      event.preventDefault()
      this.focusBubble(Math.max(0, Math.min(this.bubbles.length - 1, this.focused + moves[event.key]!)), true)
    })
    window.addEventListener('resize', () => { if (this.active) this.layout() })
    window.addEventListener('blur', () => this.stopDrag())
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.stopDrag(); this.audio.stop(); cancelAnimationFrame(this.frame); this.frame = 0 }
      else if (this.active) this.wake()
    })
  }

  setActive(active: boolean) {
    this.active = active
    if (active) { this.layout(); this.wake() }
    else { this.stopDrag(); this.audio.stop(); cancelAnimationFrame(this.frame); this.frame = 0 }
  }

  private layout() {
    const width = this.root.clientWidth
    const height = this.root.clientHeight
    if (!width || !height) return
    const columns = Math.max(1, Math.ceil(width / (width < 600 ? 54 : 68)))
    this.cellSize = width / columns
    const rows = Math.ceil(height / this.cellSize)
    this.field.style.gridTemplateColumns = `repeat(${columns}, 1fr)`
    this.field.style.gridAutoRows = `${this.cellSize}px`
    if (columns === this.columns && rows === this.rows) return
    this.stopDrag()
    this.columns = columns
    this.rows = rows
    const states = this.bubbles
    this.bubbles = []
    this.healing.clear()
    const fragment = document.createDocumentFragment()
    const appearances = createBubbleLayout(columns * rows)
    for (let i = 0; i < columns * rows; i++) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'bubble'
      button.dataset.index = String(i)
      button.dataset.phase = 'full'
      button.dataset.blushing = 'false'
      const previous = states[i]
      const appearance = previous?.appearance ?? appearances[i]!
      const artwork = bubbleArtwork(appearance)
      button.dataset.shape = appearance.shape
      button.dataset.color = appearance.color
      button.style.setProperty('--inflated-art', artwork.inflated)
      button.style.setProperty('--deflated-art', artwork.deflated)
      button.style.setProperty('--air', '1')
      button.tabIndex = i === Math.min(this.focused, columns * rows - 1) ? 0 : -1
      button.setAttribute('aria-label', `${i + 1}번째 ${colorNames[appearance.color]} ${shapeNames[appearance.shape]} 뽁뽁이 터뜨리기`)
      const membrane = document.createElement('span')
      membrane.className = 'bubble-membrane'
      membrane.setAttribute('aria-hidden', 'true')
      for (const className of ['bubble-inflated', 'bubble-deflated']) {
        const surface = document.createElement('span')
        surface.className = className
        membrane.append(surface)
      }
      button.append(membrane)
      const cheeks = document.createElement('span')
      cheeks.className = 'bubble-blush'
      cheeks.setAttribute('aria-hidden', 'true')
      for (let side = 0; side < 2; side++) {
        const cheek = document.createElement('span')
        cheek.textContent = '//'
        cheeks.append(cheek)
      }
      button.append(cheeks)
      if (previous?.element.dataset.blushing === 'true' && previous.poppedAt !== null) {
        button.dataset.blushing = 'true'
        button.style.setProperty('--blush-delay', `${-(performance.now() - previous.poppedAt) / 1000}s`)
      }
      this.bubbles.push({ appearance, element: button, poppedAt: previous?.poppedAt ?? null, hold: previous?.hold ?? 0, duration: previous?.duration ?? 1 })
      if (previous?.poppedAt != null) this.healing.add(i)
      fragment.append(button)
    }
    this.focused = Math.min(this.focused, this.bubbles.length - 1)
    this.field.replaceChildren(fragment)
    this.paint(performance.now())
  }

  private focusBubble(index: number, moveFocus: boolean) {
    if (!this.bubbles[index]) return
    if (this.bubbles[this.focused]) this.bubbles[this.focused]!.element.tabIndex = -1
    this.focused = index
    this.bubbles[index]!.element.tabIndex = 0
    if (moveFocus) this.bubbles[index]!.element.focus({ preventScroll: true })
  }

  private pop(index: number) {
    const bubble = this.bubbles[index]
    if (!this.active || !bubble || bubble.poppedAt !== null) return
    bubble.poppedAt = performance.now()
    bubble.hold = 900 + Math.random() * 700
    bubble.duration = 3500 + Math.random() * 1600
    bubble.element.style.setProperty('--air', '0')
    bubble.element.dataset.phase = 'popped'
    bubble.element.setAttribute('aria-disabled', 'true')
    bubble.element.setAttribute('aria-label', `${index + 1}번째 ${colorNames[bubble.appearance.color]} ${shapeNames[bubble.appearance.shape]} 뽁뽁이, 다시 부푸는 중`)
    this.healing.add(index)
    this.total++
    this.counter.textContent = this.total.toLocaleString('ko-KR')
    const sound = this.audio.play()
    bubble.element.style.setProperty('--blush-delay', '0s')
    bubble.element.dataset.blushing = String(sound === 'fart')
    if (sound === 'fart') bubble.element.setAttribute('aria-label', `${index + 1}번째 뽁뽁이, 발그레한 뺨, 다시 부푸는 중`)
    this.wake()
  }

  private drag(pointerId: number, end: Point) {
    const start = this.pointers.get(pointerId)
    if (!start) return
    for (const point of swipePoints(start, end, this.cellSize / 4)) {
      const element = document.elementFromPoint(point.x, point.y)?.closest<HTMLButtonElement>('.bubble')
      if (element && this.field.contains(element)) this.pop(Number(element.dataset.index))
    }
    this.pointers.set(pointerId, end)
  }

  private endPointer(id: number) {
    this.pointers.delete(id)
    if (this.field.hasPointerCapture(id)) this.field.releasePointerCapture(id)
  }

  private stopDrag() { for (const id of this.pointers.keys()) this.endPointer(id) }

  private paint(now: number) {
    for (const index of this.healing) {
      const bubble = this.bubbles[index]!
      const air = bubbleInflation(now, bubble.poppedAt!, bubble.hold, bubble.duration)
      bubble.element.style.setProperty('--air', air.toFixed(4))
      const phase = air >= 1 ? 'full' : air > 0 ? 'inflating' : 'popped'
      if (bubble.element.dataset.phase !== phase) bubble.element.dataset.phase = phase
      if (air >= 1) {
        bubble.poppedAt = null
        bubble.element.dataset.blushing = 'false'
        bubble.element.removeAttribute('aria-disabled')
        bubble.element.setAttribute('aria-label', `${index + 1}번째 ${colorNames[bubble.appearance.color]} ${shapeNames[bubble.appearance.shape]} 뽁뽁이 터뜨리기`)
        this.healing.delete(index)
      }
    }
  }

  private wake() {
    if (!this.active || document.hidden || this.frame) return
    this.paint(performance.now())
    if (this.healing.size) this.frame = requestAnimationFrame(this.tick)
  }

  private tick = (now: number) => {
    this.frame = 0
    if (!this.active || document.hidden) return
    this.paint(now)
    if (this.healing.size) this.frame = requestAnimationFrame(this.tick)
  }
}
