import { OfficeStories } from './office-stories.ts'
import { AudienceRemarks, SearchPressure, isQuietPoint, quietRadius } from './monologue-audience.ts'
import { WhistleAudio } from './whistle-audio.ts'
import type { Point } from './gestures.ts'

export const HOLD_TO_SILENCE = 5000
export function clampFontSize(value: number, fallback = 30): number {
  return Number.isFinite(value) ? Math.round(Math.max(12, Math.min(120, value))) : fallback
}
export function typingSpeed(pointer: Point | null, quiet: Point, width: number, height: number): number {
  if (!pointer) return 54
  if (isQuietPoint(pointer, quiet, width, height)) return 0
  const distance = Math.hypot((pointer.x - quiet.x) * width, (pointer.y - quiet.y) * height)
  const t = Math.max(0, Math.min(1, (distance - quietRadius(width, height)) / Math.max(1, Math.hypot(width, height) * 0.65 - quietRadius(width, height))))
  return 2.5 + (54 - 2.5) * t * t * (3 - 2 * t)
}

export const monologueMarkup = `
  <main id="page-fourth" class="monologue-page app-page" data-mode="talking" tabindex="0" aria-label="나만의 페이지, 끝없는 브랜딩 디자이너 독백" aria-describedby="monologue-help" hidden>
    <h1 class="sr-only">나만의 페이지 · 브랜딩 디자이너의 끝없는 TMI</h1>
    <div class="monologue-label" aria-hidden="true"><span></span> TMI CLUB <i>브랜딩 디자이너. 말이 너무 많아서.</i></div>
    <div class="monologue-scroll" aria-label="계속 입력되는 디자인 에이전시 이야기">
      <div id="monologue-output" aria-live="off"></div>
    </div>
    <div id="monologue-quiet" hidden>
      <svg class="quiet-whistle" viewBox="0 0 100 70" aria-hidden="true">
        <path d="M40 19H87V34H60C61 51 48 60 33 57C17 54 11 38 18 27C23 18 32 16 40 19Z" fill="#df7757"/>
        <path d="M54 19H70V26H54Z" fill="#7c4437"/>
        <circle cx="33" cy="38" r="11" fill="#f2a68a"/>
        <circle cx="16" cy="49" r="8" fill="none" stroke="#bd654e" stroke-width="4"/>
        <path d="M86 9L92 3M92 20H99M85 38L92 44" fill="none" stroke="#b0b99e" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <p class="quiet-face" aria-label="놀란 표정">( 0 - 0 )</p>
      <p class="quiet-caption">…</p>
      <p class="quiet-resume">한 번 클릭하면 다시 시작해요.</p>
    </div>
    <button type="button" id="monologue-latest" hidden>지금 하는 말로 ↓</button>
    <footer class="monologue-bottom">
      <p class="monologue-hold-note">5초 동안 꾹 누르면, 쉿.</p>
      <div class="font-controls" role="group" aria-label="글자 크기 조절">
        <span class="font-control-label">글자 크기</span>
        <button type="button" id="font-smaller" aria-label="글자 크기 줄이기">−</button>
        <label><span class="sr-only">글자 크기, 픽셀</span><input id="monologue-font-size" type="number" min="12" max="120" step="1" inputmode="numeric" value="30" /></label>
        <button type="button" id="font-larger" aria-label="글자 크기 키우기">+</button>
        <span class="font-unit" aria-hidden="true">px</span>
      </div>
      <span class="monologue-bottom-mark" aria-hidden="true">ONE MORE THING…</span>
    </footer>
    <p id="monologue-help" class="sr-only">커서를 움직이면 이야기 입력 속도가 달라집니다. 화면을 5초간 누르거나 엔터 또는 스페이스를 5초간 누르면 호루라기와 함께 멈춥니다. 멈춘 뒤 클릭하거나 엔터를 누르면 다시 시작합니다.</p>
    <p id="monologue-status" class="sr-only" role="status" aria-live="polite"></p>
  </main>
`

type Mode = 'talking' | 'silenced' | 'restarting'
export class MonologueScene {
  private root: HTMLElement
  private viewport: HTMLElement
  private output: HTMLElement
  private quiet: HTMLElement
  private input: HTMLInputElement
  private latest: HTMLButtonElement
  private status: HTMLElement
  private whistle = new WhistleAudio()
  private stories = new OfficeStories()
  private audience = new AudienceRemarks()
  private pressure = new SearchPressure()
  private wasAtQuietPoint = false
  private pendingAside: { text: string; nag: boolean } | null = null
  private activeAside: { end: number; nag: boolean } | null = null
  private writingNag = false
  private paragraph: HTMLParagraphElement | null = null
  private active = false
  private mode: Mode = 'talking'
  private fontSize = 30
  private quietSpot: Point = { x: 0.5, y: 0.5 }
  private pointer: Point | null = null
  private following = true
  private frame = 0
  private lastFrame = 0
  private budget = 0
  private speed = 54
  private letters: string[] = []
  private position = 0
  private text: Text | null = null
  private caret: HTMLSpanElement
  private holdTimer: ReturnType<typeof setTimeout> | null = null
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private heldPointer: number | null = null
  private heldKey: string | null = null
  private ignoreReleaseClick = false

  constructor(root: HTMLElement) {
    this.root = root
    this.viewport = root.querySelector<HTMLElement>('.monologue-scroll')!
    this.output = root.querySelector<HTMLElement>('#monologue-output')!
    this.quiet = root.querySelector<HTMLElement>('#monologue-quiet')!
    this.input = root.querySelector<HTMLInputElement>('#monologue-font-size')!
    this.latest = root.querySelector<HTMLButtonElement>('#monologue-latest')!
    this.status = root.querySelector<HTMLElement>('#monologue-status')!
    this.caret = document.createElement('span')
    this.caret.className = 'monologue-caret'
    this.caret.setAttribute('aria-hidden', 'true')
    root.querySelector('#font-smaller')!.addEventListener('click', () => this.setFont(this.fontSize - 2))
    root.querySelector('#font-larger')!.addEventListener('click', () => this.setFont(this.fontSize + 2))
    this.input.addEventListener('input', () => {
      const value = this.input.valueAsNumber
      if (Number.isFinite(value) && value >= 12 && value <= 120) this.setFont(value, false)
    })
    this.input.addEventListener('change', () => this.setFont(clampFontSize(this.input.valueAsNumber, this.fontSize)))
    this.latest.addEventListener('click', () => { this.following = true; this.followBottom() })
    this.viewport.addEventListener('wheel', (event) => { if (event.deltaY < 0) this.following = false }, { passive: true })
    this.viewport.addEventListener('scroll', () => {
      this.following = this.viewport.scrollHeight - this.viewport.clientHeight - this.viewport.scrollTop < 48
      this.latest.hidden = this.following || this.mode !== 'talking'
    })
    root.addEventListener('pointermove', (event) => this.setPointer(event.clientX, event.clientY))
    root.addEventListener('pointerdown', (event) => {
      if (!this.active || event.button !== 0 || this.isControl(event.target)) return
      this.setPointer(event.clientX, event.clientY)
      if (this.mode === 'silenced') { this.ignoreReleaseClick = false; return }
      if (this.mode !== 'talking' || this.heldPointer !== null) return
      this.beginHold()
      this.heldPointer = event.pointerId
      root.setPointerCapture(event.pointerId)
    })
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
      root.addEventListener(type, (event) => { if (this.heldPointer === event.pointerId) this.cancelHold() })
    }
    root.addEventListener('contextmenu', (event) => { if (!this.isControl(event.target)) event.preventDefault() })
    root.addEventListener('click', (event) => {
      if (!this.active || this.isControl(event.target)) return
      if (this.ignoreReleaseClick && event.detail !== 0) { this.ignoreReleaseClick = false; return }
      if (this.mode === 'silenced') this.restart()
    })
    root.addEventListener('keydown', (event) => {
      if (!this.active || this.isControl(event.target) || !['Space', 'Enter'].includes(event.code)) return
      event.preventDefault()
      if (event.repeat) return
      if (this.mode === 'silenced') this.restart()
      else if (this.mode === 'talking' && this.heldKey === null) { this.beginHold(); this.heldKey = event.code }
    })
    root.addEventListener('keyup', (event) => { if (event.code === this.heldKey) { event.preventDefault(); this.cancelHold() } })
    window.addEventListener('blur', () => { this.cancelHold(); this.whistle.stop() })
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause()
      else if (this.active) this.wake()
    })
    this.setFont(30)
  }

  setActive(active: boolean) {
    if (this.active === active) return
    this.active = active
    this.pause()
    if (active) {
      this.quietSpot = { x: 0.2 + Math.random() * 0.6, y: 0.2 + Math.random() * 0.6 }
      this.pointer = null
      this.resetSearch()
      this.wake()
    }
  }

  private isControl(target: EventTarget | null): boolean { return !!(target as Element | null)?.closest('button, input, label, a') }

  private setPointer(x: number, y: number) {
    if (!this.active) return
    const bounds = this.root.getBoundingClientRect()
    this.pointer = { x: (x - bounds.left) / Math.max(1, bounds.width), y: (y - bounds.top) / Math.max(1, bounds.height) }
  }

  private setFont(value: number, syncInput = true) {
    this.fontSize = clampFontSize(value, this.fontSize)
    this.root.style.setProperty('--monologue-font-size', `${this.fontSize}px`)
    if (syncInput) this.input.value = String(this.fontSize)
    if (this.following) this.followBottom()
  }

  private beginHold() {
    this.cancelHold()
    this.whistle.unlock()
    this.root.dataset.pressing = 'true'
    this.holdTimer = setTimeout(() => { if (this.active && this.mode === 'talking') this.silence() }, HOLD_TO_SILENCE)
  }

  private cancelHold() {
    if (this.holdTimer !== null) clearTimeout(this.holdTimer)
    this.holdTimer = null
    const id = this.heldPointer
    this.heldPointer = null
    this.heldKey = null
    this.root.dataset.pressing = 'false'
    if (id !== null && this.root.hasPointerCapture(id)) this.root.releasePointerCapture(id)
  }

  private silence() {
    this.ignoreReleaseClick = true
    this.cancelHold()
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.lastFrame = 0
    this.mode = 'silenced'
    this.root.dataset.mode = this.mode
    this.output.replaceChildren()
    this.text = null
    this.paragraph = null
    this.clearAside()
    this.pressure.pause()
    this.quiet.hidden = false
    this.latest.hidden = true
    this.status.textContent = '호루라기! 말이 멈췄습니다. 한 번 클릭하면 다시 시작합니다.'
    this.whistle.play(false)
  }

  private restart() {
    this.whistle.play(true)
    this.mode = 'restarting'
    this.root.dataset.mode = this.mode
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      if (!this.active || document.hidden) { this.mode = 'silenced'; this.root.dataset.mode = this.mode; return }
      this.output.replaceChildren()
      this.text = null
      this.paragraph = null
      this.writingNag = false
      this.clearAside()
      this.letters = []
      this.position = 0
      this.budget = 0
      this.speed = 54
      this.viewport.scrollTop = 0
      this.following = true
      this.quietSpot = { x: 0.2 + Math.random() * 0.6, y: 0.2 + Math.random() * 0.6 }
      this.resetSearch()
      this.mode = 'talking'
      this.root.dataset.mode = this.mode
      this.quiet.hidden = true
      this.status.textContent = '다시 이야기를 시작합니다.'
      this.wake()
    }, 180)
  }

  private pause() {
    this.pressure.pause()
    this.cancelHold()
    cancelAnimationFrame(this.frame)
    this.frame = 0
    this.lastFrame = 0
    this.whistle.stop()
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
      this.mode = 'silenced'
      this.root.dataset.mode = this.mode
    }
  }

  private resetSearch() {
    this.clearAside()
    this.wasAtQuietPoint = false
    this.pressure.reset(performance.now())
  }

  private clearAside() {
    this.pendingAside = null
    if (this.activeAside && this.position < this.activeAside.end) {
      this.letters.splice(this.position, this.activeAside.end - this.position)
    }
    this.activeAside = null
  }

  private setTextStyle(nag: boolean) {
    if (this.writingNag === nag && this.text) return
    const text = document.createTextNode('')
    if (nag) {
      const span = document.createElement('span')
      span.className = 'monologue-nag'
      span.append(text)
      this.paragraph!.insertBefore(span, this.caret)
    } else this.paragraph!.insertBefore(text, this.caret)
    this.text = text
    this.writingNag = nag
  }

  private append(count: number) {
    for (let i = 0; i < count; i++) {
      if (!this.text || this.position >= this.letters.length) {
        const paragraph = document.createElement('p')
        this.text = document.createTextNode('')
        this.paragraph = paragraph
        this.writingNag = false
        this.activeAside = null
        paragraph.append(this.text, this.caret)
        this.output.append(paragraph)
        this.letters = Array.from(this.stories.next())
        this.position = 0
      }
      // Interrupt at a word boundary; keep only one pending remark, never an expanding queue.
      if (this.pendingAside && !this.activeAside && (this.position === 0 || /[\s.!?…]/u.test(this.letters[this.position - 1]!))) {
        const remark = Array.from(` ${this.pendingAside.text} `)
        this.letters.splice(this.position, 0, ...remark)
        this.activeAside = { end: this.position + remark.length, nag: this.pendingAside.nag }
        this.pendingAside = null
      }
      this.setTextStyle(this.activeAside?.nag ?? false)
      this.text!.appendData(this.letters[this.position++]!)
      if (this.activeAside && this.position >= this.activeAside.end) this.activeAside = null
    }
    // Bound memory for long sessions and compensate the reading position when old paragraphs leave.
    if (this.output.children.length > 80) {
      const previousHeight = this.viewport.scrollHeight
      while (this.output.children.length > 80) this.output.firstElementChild?.remove()
      if (!this.following) this.viewport.scrollTop -= previousHeight - this.viewport.scrollHeight
    }
    if (this.following) this.followBottom()
    else this.latest.hidden = false
  }

  private followBottom() { this.viewport.scrollTop = this.viewport.scrollHeight; this.latest.hidden = true }

  private wake() {
    if (this.active && !document.hidden && this.mode === 'talking' && !this.frame) this.frame = requestAnimationFrame(this.tick)
  }

  private tick = (now: number) => {
    this.frame = 0
    if (!this.active || document.hidden || this.mode !== 'talking') return
    const dt = this.lastFrame ? Math.min(100, now - this.lastFrame) : 16
    this.lastFrame = now
    const found = isQuietPoint(this.pointer, this.quietSpot, this.root.clientWidth, this.root.clientHeight)
    const complaintLevel = this.pressure.update(now, found)
    if (found) {
      if (!this.wasAtQuietPoint) this.clearAside()
      this.wasAtQuietPoint = true
      this.speed = 0
      this.budget = 0
      this.wake()
      return
    }
    if (this.wasAtQuietPoint) {
      this.wasAtQuietPoint = false
      this.pendingAside = { text: this.audience.found(), nag: false }
    }
    if (complaintLevel !== null) this.pendingAside = { text: this.audience.complaint(complaintLevel), nag: true }
    const targetSpeed = typingSpeed(this.pointer, this.quietSpot, this.root.clientWidth, this.root.clientHeight)
    this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-dt / 180))
    this.budget += dt / 1000 * this.speed
    const count = Math.min(8, Math.floor(this.budget))
    if (count) { this.budget -= count; this.append(count) }
    this.wake()
  }
}
