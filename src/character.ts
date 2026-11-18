import type { Point } from './gestures.ts'

interface Bounds { left: number; top: number; width: number; height: number }
const smoothstep = (t: number) => t * t * (3 - 2 * t)

/** Keep the pupils inside the whites even when the pointer is far outside the sphere. */
export function gazeDirection(point: Point, bounds: Bounds): Point {
  const x = (point.x - bounds.left - bounds.width / 2) / Math.max(1, bounds.width * 0.8)
  const y = (point.y - bounds.top - bounds.height / 2) / Math.max(1, bounds.height * 0.8)
  const distance = Math.max(1, Math.hypot(x, y))
  return { x: x / distance, y: y / distance }
}

/** Close, hold, then reopen one eye; negative time allows looking before winking. */
export function winkClosure(elapsed: number): number {
  if (elapsed < 0 || elapsed >= 460) return 0
  if (elapsed < 90) return smoothstep(elapsed / 90)
  if (elapsed < 250) return 1
  return 1 - smoothstep((elapsed - 250) / 210)
}

export const characterMarkup = `
  <main class="character-page app-page" id="page-third" hidden>
    <header class="character-heading">
      <p>HELLO, USAGI</p>
      <h1>눈이 마주치는 순간</h1>
    </header>
    <div class="orb-orbit orbit-one" aria-hidden="true"></div>
    <div class="orb-orbit orbit-two" aria-hidden="true"></div>
    <div class="orb-ground" aria-hidden="true"></div>
    <button type="button" class="friend-orb" aria-label="토끼 우사기에게 윙크와 목소리로 인사하기" aria-describedby="character-help">
      <span class="orb-glass" aria-hidden="true"></span>
      <svg class="orb-character" viewBox="0 0 440 440" aria-hidden="true">
        <g class="rabbit-ears" fill="#fbefc9">
          <path d="M195 180C190 155 188 117 190 92C191 70 196 57 203 60C213 65 214 105 212 176Z"/>
          <path d="M224 179C224 151 221 117 226 89C230 66 235 57 241 61C252 68 248 115 246 143L244 179Z"/>
          <path fill="#fac1ce" d="M197 173C192 149 192 113 194 94C195 80 199 78 202 91C207 111 207 149 206 173Z"/>
          <path fill="#fac1ce" d="M232 173C228 151 229 116 232 94C234 80 239 78 241 91C245 111 241 151 240 174Z"/>
        </g>
        <path fill="#fbefc9" d="M195 171C139 169 97 205 88 260C77 312 101 342 153 357C190 368 237 369 275 359C328 348 353 326 352 283C351 222 315 181 258 173C244 169 215 168 195 171Z"/>
        <g id="friend-face">
          <ellipse class="rabbit-cheek" cx="135" cy="286" rx="24" ry="17" fill="#fac0ce"/>
          <ellipse class="rabbit-cheek" cx="305" cy="286" rx="24" ry="17" fill="#fac0ce"/>
          <g fill="none" stroke="#14130f" stroke-width="4.5" stroke-linecap="round">
            <path d="M120 289L126 280M131 290L137 280M142 290L148 282"/>
            <path d="M291 290L297 280M302 290L308 280M313 290L319 282"/>
          </g>
          <g id="friend-eye-left">
            <g class="friend-pupil">
              <circle cx="177" cy="261" r="14" fill="#0c0d0b"/>
              <ellipse cx="174" cy="256" rx="4.6" ry="3.7" fill="#fff" transform="rotate(-20 174 256)"/>
              <ellipse cx="180" cy="268" rx="3.5" ry="1.7" fill="#fff"/>
            </g>
          </g>
          <g id="friend-eye-right">
            <g class="friend-pupil">
              <circle cx="262" cy="261" r="14" fill="#0c0d0b"/>
              <ellipse cx="259" cy="256" rx="4.6" ry="3.7" fill="#fff" transform="rotate(-20 259 256)"/>
              <ellipse cx="265" cy="268" rx="3.5" ry="1.7" fill="#fff"/>
            </g>
          </g>
          <path id="friend-wink" d="M250 261Q262 274 274 261" fill="none" stroke="#14130f" stroke-width="4.5" stroke-linecap="round" opacity="0"/>
          <path d="M136 240C132 221 153 193 177 196" fill="none" stroke="#14130f" stroke-width="5" stroke-linecap="round"/>
          <path id="friend-brow-right" d="M251 196C277 186 305 213 305 244" fill="none" stroke="#14130f" stroke-width="5" stroke-linecap="round"/>
          <path id="friend-smile" d="M207 285C207 293 217 294 220 287C223 294 233 293 233 286" fill="none" stroke="#14130f" stroke-width="4.5" stroke-linecap="round"/>
          <path d="M220 288C217 296 217 304 223 303" fill="none" stroke="#14130f" stroke-width="4.5" stroke-linecap="round"/>
        </g>
      </svg>
      <span class="orb-reflection" aria-hidden="true"></span>
      <span class="orb-spark spark-one" aria-hidden="true">✦</span>
      <span class="orb-spark spark-two" aria-hidden="true">✧</span>
    </button>
    <div class="character-caption">
      <p class="character-greeting">어디를 가든, 눈은 당신에게.</p>
      <p id="character-help"><span>움직이면 눈맞춤</span><i aria-hidden="true">·</i><span>클릭·터치하면 윙크와 목소리</span></p>
      <p class="sr-only">키보드로는 캐릭터 버튼에 초점을 맞추고 엔터 또는 스페이스를 누르면 윙크하며 소리가 납니다.</p>
    </div>
    <footer class="character-footer"><span>작은 눈맞춤 작업실</span><span>A SMALL HELLO GOES A LONG WAY</span></footer>
    <p class="sr-only" id="character-status" role="status" aria-live="polite"></p>
  </main>
`

export class CharacterScene {
  private root: HTMLElement
  private orb: HTMLButtonElement
  private face: SVGGElement
  private pupils: SVGGElement[]
  private eye: SVGGElement
  private wink: SVGPathElement
  private brow: SVGPathElement
  private smile: SVGPathElement
  private status: HTMLElement
  private soundUrls: readonly string[]
  private voice: HTMLAudioElement | null = null
  private active = false
  private frame = 0
  private lastFrame = 0
  private target: Point = { x: 0, y: 0 }
  private current: Point = { x: 0, y: 0 }
  private pointer: Point | null = null
  private bounds: Bounds = { left: 0, top: 0, width: 1, height: 1 }
  private winkAt: number | null = null
  private holdUntil = 0
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(root: HTMLElement, soundUrls: readonly string[]) {
    this.root = root
    this.soundUrls = soundUrls
    this.orb = root.querySelector<HTMLButtonElement>('.friend-orb')!
    this.face = root.querySelector<SVGGElement>('#friend-face')!
    this.pupils = [...root.querySelectorAll<SVGGElement>('.friend-pupil')]
    this.eye = root.querySelector<SVGGElement>('#friend-eye-right')!
    this.wink = root.querySelector<SVGPathElement>('#friend-wink')!
    this.brow = root.querySelector<SVGPathElement>('#friend-brow-right')!
    this.smile = root.querySelector<SVGPathElement>('#friend-smile')!
    this.status = root.querySelector<HTMLElement>('#character-status')!
    window.addEventListener('pointermove', (event) => this.lookAt({ x: event.clientX, y: event.clientY }))
    root.addEventListener('pointerdown', (event) => {
      if (event.button === 0) this.lookAt({ x: event.clientX, y: event.clientY })
    })
    root.addEventListener('click', (event) => {
      if (!this.active) return
      const point = event.detail === 0
        ? this.pointer ?? { x: this.bounds.left + this.bounds.width / 2, y: this.bounds.top + this.bounds.height / 2 }
        : { x: event.clientX, y: event.clientY }
      this.greet(point)
    })
    window.addEventListener('pointerout', (event) => {
      if (event.relatedTarget !== null || !this.active) return
      this.pointer = null
      if (performance.now() >= this.holdUntil) this.target = { x: 0, y: 0 }
      this.wake()
    })
    window.addEventListener('resize', () => {
      if (!this.active) return
      this.measure()
      if (this.pointer && performance.now() >= this.holdUntil) this.target = gazeDirection(this.pointer, this.bounds)
      this.wake()
    })
    window.addEventListener('blur', () => this.reset())
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset() })
  }

  setActive(active: boolean) {
    this.active = active
    this.reset()
    if (active) this.measure()
  }

  private measure() { this.bounds = this.orb.getBoundingClientRect() }

  private reset() {
    cancelAnimationFrame(this.frame)
    if (this.voice) {
      this.voice.pause()
      this.voice.currentTime = 0
    }
    this.frame = 0
    this.lastFrame = 0
    this.pointer = null
    this.target = { x: 0, y: 0 }
    this.current = { x: 0, y: 0 }
    this.winkAt = null
    this.holdUntil = 0
    this.render(0)
  }

  private lookAt(point: Point) {
    if (!this.active || document.hidden) return
    this.pointer = point
    if (performance.now() >= this.holdUntil) this.target = gazeDirection(point, this.bounds)
    this.wake()
  }

  private greet(point: Point) {
    this.pointer = point
    this.target = gazeDirection(point, this.bounds)
    this.winkAt = performance.now() + 120
    this.holdUntil = this.winkAt + 540
    this.status.textContent = '우사기가 당신이 누른 곳을 바라보며 윙크하고 인사했어요.'
    this.playVoice()
    this.wake()
  }

  private playVoice() {
    if (this.soundUrls.length === 0) return
    const soundUrl = this.soundUrls[Math.floor(Math.random() * this.soundUrls.length)]!
    if (!this.voice) {
      this.voice = new Audio(soundUrl)
      this.voice.preload = 'auto'
      this.voice.volume = 0.8
    } else {
      this.voice.pause()
      this.voice.src = soundUrl
    }
    // Restart one clip on each greeting so rapid clicks cannot stack voices.
    this.voice.currentTime = 0
    void this.voice.play().catch((error: unknown) => {
      if (this.active && !(error instanceof DOMException && error.name === 'AbortError')) {
        this.status.textContent = '윙크했어요. 소리를 재생하지 못했습니다.'
      }
    })
  }

  private wake() {
    if (!this.active || document.hidden || this.frame) return
    this.frame = requestAnimationFrame(this.tick)
  }

  private render(closure: number) {
    const { x, y } = this.current
    const roll = this.reducedMotion ? 0 : x * 2
    this.face.setAttribute('transform', `translate(${x * 10} ${y * 8}) rotate(${roll} 220 262)`)
    for (const pupil of this.pupils) pupil.setAttribute('transform', `translate(${x * 6} ${y * 7})`)
    this.eye.setAttribute('transform', `translate(262 261) scale(1 ${1 - closure * 0.98}) translate(-262 -261)`)
    this.eye.setAttribute('opacity', String(1 - closure))
    this.wink.setAttribute('opacity', String(closure))
    this.brow.setAttribute('transform', `translate(0 ${-closure * 3}) rotate(${-closure * 3} 262 218)`)
    this.smile.setAttribute('d', `M207 ${285 - closure * 2}C207 293 217 294 220 287C223 294 233 293 233 ${286 - closure * 2}`)
    this.root.dataset.winking = String(closure > 0.1)
    this.orb.style.setProperty('--gaze-x', `${x * 5}px`)
    this.orb.style.setProperty('--gaze-y', `${y * 4}px`)
  }

  private tick = (now: number) => {
    this.frame = 0
    if (!this.active || document.hidden) return
    const dt = this.lastFrame ? Math.min(64, now - this.lastFrame) : 16
    this.lastFrame = now
    if (this.holdUntil > 0 && now >= this.holdUntil) {
      this.target = this.pointer ? gazeDirection(this.pointer, this.bounds) : { x: 0, y: 0 }
      this.holdUntil = 0
    }
    const ease = 1 - Math.exp(-dt / (this.reducedMotion ? 45 : 85))
    this.current.x += (this.target.x - this.current.x) * ease
    this.current.y += (this.target.y - this.current.y) * ease
    const closure = this.winkAt === null ? 0 : winkClosure(now - this.winkAt)
    if (this.winkAt !== null && now >= this.winkAt + 460) this.winkAt = null
    this.render(closure)
    const distance = Math.hypot(this.current.x - this.target.x, this.current.y - this.target.y)
    if (distance > 0.001 || this.winkAt !== null || this.holdUntil > now) this.wake()
    else this.lastFrame = 0
  }
}
