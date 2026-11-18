import type { Point } from './gestures.ts'

export type CatMood = 'bored' | 'petting' | 'angry' | 'melted'
export const MELT_DURATION = 10_000

/** Accumulate only time spent moving gently while the pointer is on the cat. */
export class CatPetting {
  elapsed = 0
  angryUntil = 0
  lastGentle = -Infinity
  private lastPoint: Point | null = null
  private lastTime = 0

  move(point: Point, now: number, inside: boolean, width: number): 'none' | 'gentle' | 'angry' {
    if (!inside) { this.leave(); return 'none' }
    const previous = this.lastPoint
    const dt = now - this.lastTime
    this.lastPoint = point
    this.lastTime = now
    if (!previous || dt <= 0 || dt > 150 || this.elapsed >= MELT_DURATION) return 'none'
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y)
    if (distance < 0.15) return 'none'
    const speed = distance / dt * 1000
    const limit = Math.max(140, Math.min(260, width * 0.8))
    if (speed > limit) {
      this.angryUntil = now + 1200
      return 'angry'
    }
    if (now < this.angryUntil) return 'none'
    this.elapsed = Math.min(MELT_DURATION, this.elapsed + Math.min(dt, 100))
    this.lastGentle = now
    return 'gentle'
  }

  keyboard(dt: number, now: number) {
    if (now < this.angryUntil) return
    this.elapsed = Math.min(MELT_DURATION, this.elapsed + Math.min(dt, 100))
    this.lastGentle = now
  }
  leave() { this.lastPoint = null; this.lastTime = 0 }
  reset() { this.elapsed = 0; this.angryUntil = 0; this.lastGentle = -Infinity; this.leave() }
  mood(now: number): CatMood {
    if (this.elapsed >= MELT_DURATION) return 'melted'
    if (now < this.angryUntil) return 'angry'
    return now - this.lastGentle < 700 ? 'petting' : 'bored'
  }
}

const startShape = [100,306, 100,240,150,218,200,220, 212,196,240,190,260,190, 280,190,308,196,320,220, 370,218,420,240,420,306, 420,360,363,370,260,370, 157,370,100,360,100,306]
const endShape = [48,357, 48,346,100,342,170,344, 200,339,230,340,260,341, 290,340,320,339,350,344, 420,342,472,346,472,357, 472,379,380,386,260,384, 140,386,48,379,48,357]
export function catBodyPath(progress: number): string {
  const t = Math.max(0, Math.min(1, progress))
  const p = startShape.map((value, i) => Math.round((value + (endShape[i]! - value) * t) * 100) / 100)
  return `M${p[0]} ${p[1]} C${p.slice(2, 8).join(' ')} C${p.slice(8, 14).join(' ')} C${p.slice(14, 20).join(' ')} C${p.slice(20, 26).join(' ')} C${p.slice(26, 32).join(' ')} C${p.slice(32, 38).join(' ')} Z`
}

/** Quiet, synthesized cat-like meows and a short hiss. */
class CatSound {
  private context: AudioContext | null = null
  private nodes = new Set<AudioBufferSourceNode>()
  enabled = true
  unlocked = false

  unlock(): boolean {
    if (!this.enabled) return false
    try {
      if (!this.context) this.context = new AudioContext()
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
      this.unlocked = true
      return true
    } catch { return false }
  }
  toggle() {
    if (!this.unlocked) { this.enabled = true; this.unlock(); return }
    this.enabled = !this.enabled
    if (this.enabled) this.unlock()
    else this.stop()
  }
  play(kind: 'complaint' | 'angry') {
    if (!this.enabled || !this.unlocked || !this.context) return
    const ctx = this.context
    const duration = kind === 'angry' ? 0.28 : 0.62
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let phase = 0, noise = 0
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate
      const envelope = Math.sin(Math.PI * t / duration) ** 0.8
      if (kind === 'angry') {
        noise = noise * 0.55 + (Math.random() * 2 - 1) * 0.45
        data[i] = noise * envelope * 0.22
      } else {
        const pitch = 430 + 180 * Math.sin(Math.PI * t / duration) - 115 * t / duration + 8 * Math.sin(t * 40)
        phase += Math.PI * 2 * pitch / ctx.sampleRate
        const voice = Math.sin(phase) * 0.55 + Math.sin(phase * 2) * 0.25 + Math.sin(phase * 3) * 0.12
        data[i] = voice * envelope * 0.24
      }
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(ctx.destination)
    this.nodes.add(source)
    source.onended = () => { this.nodes.delete(source); source.disconnect() }
    source.start()
  }
  stop() {
    for (const node of this.nodes) { try { node.stop() } catch { /* Already stopped. */ } }
    this.nodes.clear()
  }
}

export const catMarkup = `
  <main class="cat-page app-page" id="page-fifth" data-mood="bored" hidden>
    <div class="cat-page-label"><span>05</span> THE MELTING CAT</div>
    <header class="cat-heading"><p>A LITTLE SOFT MOMENT</p><h1>살살 만져주세요.</h1><p class="cat-intro">천천히 쓰다듬으면 고양이가 조금씩 녹아요.</p></header>
    <div class="cat-scene">
      <div class="cat-halo" aria-hidden="true"></div><div class="cat-shadow" aria-hidden="true"></div>
      <div class="cat-stage" role="button" tabindex="0" aria-label="고양이 쓰다듬기" aria-describedby="cat-help">
        <svg class="cat-illustration" viewBox="0 0 520 420" aria-hidden="true">
          <defs>
            <linearGradient id="cat-fur" x1=".2" y1="0" x2=".75" y2="1"><stop stop-color="#fff9ec"/><stop offset=".58" stop-color="#f4e3cc"/><stop offset="1" stop-color="#e5c8ab"/></linearGradient>
            <linearGradient id="cat-liquid" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffdf3"/><stop offset=".55" stop-color="#f1d9bc"/><stop offset="1" stop-color="#ddbda0"/></linearGradient>
          </defs>
          <g id="cat-tail-outer"><g class="cat-tail-swing"><path d="M362 300C410 310 452 293 453 253C453 236 444 226 435 229C423 233 433 249 425 257C414 269 389 262 370 258" fill="none" stroke="#ddbaa0" stroke-width="28" stroke-linecap="round"/><path d="M363 292C407 300 443 286 442 254" fill="none" stroke="#f9ead6" stroke-width="15" stroke-linecap="round"/></g></g>
          <path id="cat-body" fill="url(#cat-fur)" stroke="#cba98d" stroke-width="3"/>
          <g id="cat-head">
            <path d="M150 167L157 89Q159 78 170 82L208 110Q260 98 312 110L350 82Q361 78 363 89L370 167Q389 192 378 226Q367 258 333 275Q298 292 260 292Q222 292 187 275Q153 258 142 226Q131 192 150 167Z" fill="url(#cat-fur)" stroke="#cba98d" stroke-width="3" stroke-linejoin="round"/>
            <path d="M162 147L166 100L194 121Z M358 147L354 100L326 121Z" fill="#e9b8b0"/>
            <path d="M185 143Q201 133 214 137M306 137Q319 133 335 143" fill="none" stroke="#e2c5ad" stroke-width="7" stroke-linecap="round"/>
            <ellipse cx="176" cy="211" rx="19" ry="9" fill="#edbcb4" opacity=".48"/><ellipse cx="344" cy="211" rx="19" ry="9" fill="#edbcb4" opacity=".48"/>
            <g class="cat-face cat-bored" fill="none" stroke="#6c554b" stroke-width="5" stroke-linecap="round"><path d="M199 186Q216 191 231 186M289 186Q304 191 321 186"/><path d="M251 220Q260 215 269 220"/></g>
            <g class="cat-face cat-petting" fill="none" stroke="#6c554b" stroke-width="5" stroke-linecap="round"><path d="M199 188Q215 201 231 188M289 188Q305 201 321 188"/><path d="M246 215Q253 228 260 216Q267 228 274 215"/></g>
            <g class="cat-face cat-angry" fill="none" stroke="#705147" stroke-width="5" stroke-linecap="round"><path d="M198 177L230 190M290 190L322 177M203 200L229 193M291 193L317 200"/><path d="M248 226Q260 214 272 226"/></g>
            <path d="M253 205Q260 201 267 205L260 212Z" fill="#d28e86"/>
            <path d="M175 220L139 214M176 229L139 233M344 220L381 214M344 229L381 233" fill="none" stroke="#caa991" stroke-width="2.5" stroke-linecap="round"/>
            <g class="cat-angry-mark" fill="none" stroke="#d7786a" stroke-width="4" stroke-linecap="round"><path d="M353 150l11 -7m-3 13 12 2"/></g>
          </g>
          <g id="cat-paws" fill="#f9ebd9" stroke="#d4b49a" stroke-width="2"><ellipse cx="207" cy="341" rx="42" ry="19"/><ellipse cx="313" cy="341" rx="42" ry="19"/></g>
          <g id="cat-shine" opacity="0" fill="none" stroke="#fffefa" stroke-width="4" stroke-linecap="round"><path d="M110 357Q160 346 200 350M350 354Q392 350 416 357"/></g>
          <path id="cat-body-hit" class="cat-hit" fill="transparent" pointer-events="all"/>
          <g id="cat-head-hit"><path class="cat-hit" d="M150 167L157 89Q159 78 170 82L208 110Q260 98 312 110L350 82Q361 78 363 89L370 167Q389 192 378 226Q367 258 333 275Q298 292 260 292Q222 292 187 275Q153 258 142 226Q131 192 150 167Z" fill="transparent" pointer-events="all"/></g>
        </svg>
      </div>
      <span class="cat-spark cat-spark-one" aria-hidden="true">✳</span><span class="cat-spark cat-spark-two" aria-hidden="true">✦</span>
    </div>
    <div class="cat-bottom">
      <p id="cat-message">심심한데… 안 만져줄 거야?</p>
      <div class="cat-meter"><div class="cat-meter-label"><span>말랑해지는 중</span><strong id="cat-percent">0%</strong></div><div class="cat-meter-track" role="progressbar" aria-label="고양이가 녹은 정도" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="cat-progress"></span></div></div>
      <p id="cat-help">고양이 위를 천천히 움직여 주세요. 빠르면 화를 내요.</p>
      <p class="sr-only">키보드는 고양이에 초점을 맞추고 스페이스나 엔터를 누르고 있으면 천천히 쓰다듬습니다.</p>
    </div>
    <footer class="cat-footer"><span>천천히, 다정하게</span><div><button id="cat-reset" type="button">처음부터 ↺</button><button id="cat-sound" type="button" aria-pressed="true">소리 켜기 ♪</button></div></footer>
    <p id="cat-status" class="sr-only" role="status" aria-live="polite"></p>
  </main>
`

export class CatScene {
  private tracker = new CatPetting()
  private sound = new CatSound()
  private root: HTMLElement
  private stage: HTMLElement
  private body: SVGPathElement
  private bodyHit: SVGPathElement
  private head: SVGGElement
  private headHit: SVGGElement
  private tail: SVGGElement
  private paws: SVGGElement
  private shine: SVGGElement
  private progress: HTMLElement
  private meter: HTMLElement
  private percent: HTMLElement
  private message: HTMLElement
  private soundButton: HTMLButtonElement
  private status: HTMLElement
  private active = false
  private frame = 0
  private lastFrame = 0
  private nextComplaint = 0
  private lastAngrySound = -Infinity
  private keyHeld = false
  private lastMood: CatMood = 'bored'
  private shownPercent = -1

  constructor(root: HTMLElement, navigation: HTMLButtonElement) {
    this.root = root
    this.stage = root.querySelector<HTMLElement>('.cat-stage')!
    this.body = root.querySelector<SVGPathElement>('#cat-body')!
    this.bodyHit = root.querySelector<SVGPathElement>('#cat-body-hit')!
    this.head = root.querySelector<SVGGElement>('#cat-head')!
    this.headHit = root.querySelector<SVGGElement>('#cat-head-hit')!
    this.tail = root.querySelector<SVGGElement>('#cat-tail-outer')!
    this.paws = root.querySelector<SVGGElement>('#cat-paws')!
    this.shine = root.querySelector<SVGGElement>('#cat-shine')!
    this.progress = root.querySelector<HTMLElement>('#cat-progress')!
    this.meter = root.querySelector<HTMLElement>('.cat-meter-track')!
    this.percent = root.querySelector<HTMLElement>('#cat-percent')!
    this.message = root.querySelector<HTMLElement>('#cat-message')!
    this.soundButton = root.querySelector<HTMLButtonElement>('#cat-sound')!
    this.status = root.querySelector<HTMLElement>('#cat-status')!
    navigation.addEventListener('click', () => { this.sound.unlock(); this.updateSoundButton() })
    this.soundButton.addEventListener('click', () => { this.sound.toggle(); this.updateSoundButton() })
    root.querySelector<HTMLButtonElement>('#cat-reset')!.addEventListener('click', () => this.reset())
    root.addEventListener('pointermove', (event) => this.pointerMove(event))
    root.addEventListener('pointerleave', () => this.tracker.leave())
    this.stage.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      this.sound.unlock(); this.updateSoundButton()
      if (event.pointerType === 'touch') this.stage.setPointerCapture(event.pointerId)
    })
    this.stage.addEventListener('pointercancel', () => this.tracker.leave())
    this.stage.addEventListener('pointerup', () => this.tracker.leave())
    this.stage.addEventListener('keydown', (event) => {
      if (!this.active || (event.code !== 'Space' && event.code !== 'Enter')) return
      event.preventDefault()
      this.sound.unlock(); this.updateSoundButton()
      this.keyHeld = true
    })
    this.stage.addEventListener('keyup', (event) => {
      if (event.code === 'Space' || event.code === 'Enter') { event.preventDefault(); this.keyHeld = false }
    })
    this.stage.addEventListener('blur', () => { this.keyHeld = false })
    window.addEventListener('blur', () => { this.keyHeld = false; this.tracker.leave(); this.sound.stop() })
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause()
      else if (this.active) this.wake()
    })
    this.updateSoundButton()
    this.render(performance.now())
  }

  setActive(active: boolean) {
    if (this.active === active) return
    this.active = active
    this.pause()
    if (active) { this.nextComplaint = performance.now() + 3000; this.wake() }
  }

  private pause() {
    cancelAnimationFrame(this.frame); this.frame = 0; this.lastFrame = 0
    this.keyHeld = false; this.tracker.leave(); this.sound.stop()
  }

  private reset() {
    this.tracker.reset()
    this.keyHeld = false
    this.nextComplaint = performance.now() + 3000
    this.status.textContent = '고양이가 다시 통통해졌어요.'
    this.render(performance.now())
  }

  private updateSoundButton() {
    this.soundButton.setAttribute('aria-pressed', String(this.sound.enabled && this.sound.unlocked))
    this.soundButton.textContent = !this.sound.unlocked ? '소리 켜기 ♪' : this.sound.enabled ? '소리 켜짐 ♪' : '소리 꺼짐 ◌'
  }

  private pointerMove(event: PointerEvent) {
    if (!this.active || document.hidden) return
    const point = { x: event.clientX, y: event.clientY }
    const element = document.elementFromPoint(point.x, point.y)
    const inside = !!element?.closest('.cat-hit') && this.stage.contains(element)
    const now = performance.now()
    const result = this.tracker.move(point, now, inside, this.stage.clientWidth)
    if (result === 'angry' && now - this.lastAngrySound > 1200) {
      this.sound.play('angry'); this.lastAngrySound = now
    }
    this.render(now)
  }

  private render(now: number) {
    const amount = this.tracker.elapsed / MELT_DURATION
    const path = catBodyPath(amount)
    this.body.setAttribute('d', path)
    this.bodyHit.setAttribute('d', path)
    this.body.setAttribute('fill', amount > 0.9 ? 'url(#cat-liquid)' : 'url(#cat-fur)')
    const headTransform = `translate(260 ${200 + amount * 152}) scale(${1 + amount * 0.28} ${1 - amount * 0.88}) translate(-260 -200)`
    this.head.setAttribute('transform', headTransform)
    this.headHit.setAttribute('transform', headTransform)
    this.tail.setAttribute('opacity', String(Math.max(0, 1 - amount * 1.5)))
    this.paws.setAttribute('opacity', String(Math.max(0, 1 - amount * 1.6)))
    this.shine.setAttribute('opacity', String(Math.max(0, (amount - 0.65) / 0.35)))
    const percent = Math.min(100, Math.floor(amount * 100))
    if (this.shownPercent !== percent) {
      this.shownPercent = percent
      this.percent.textContent = `${percent}%`
      this.meter.setAttribute('aria-valuenow', String(percent))
      this.progress.style.width = `${percent}%`
    }
    const mood = this.tracker.mood(now)
    if (this.lastMood !== mood || this.root.dataset.mood !== mood) {
      this.lastMood = mood
      this.root.dataset.mood = mood
      this.message.textContent = ({ bored: '심심한데… 안 만져줄 거야?', petting: '으응… 거기, 천천히.', angry: '앗! 너무 빠르잖아!', melted: '말랑말랑… 완전히 녹아버렸어.' })[mood]
      if (mood === 'melted') this.status.textContent = '고양이가 완전히 녹았어요. 처음부터 버튼으로 다시 시작할 수 있어요.'
      if (mood === 'petting') this.nextComplaint = now + 3000
      if (mood === 'bored') this.nextComplaint = now + 1800
    }
  }

  private wake() { if (this.active && !document.hidden && !this.frame) this.frame = requestAnimationFrame(this.tick) }
  private tick = (now: number) => {
    this.frame = 0
    if (!this.active || document.hidden) return
    const dt = this.lastFrame ? Math.min(100, now - this.lastFrame) : 0
    this.lastFrame = now
    if (this.keyHeld) this.tracker.keyboard(dt, now)
    this.render(now)
    if (this.tracker.mood(now) === 'bored' && now >= this.nextComplaint) {
      this.sound.play('complaint'); this.nextComplaint = now + 6500
    }
    this.wake()
  }
}
