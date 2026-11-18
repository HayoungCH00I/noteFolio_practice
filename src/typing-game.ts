export const typingGameMarkup = `
  <main class="typing-page app-page" id="page-sixth" hidden>
    <div class="typing-alert" aria-hidden="true"></div>
    <canvas class="typing-canvas" aria-hidden="true"></canvas>
    <div class="typing-heading"><span>WEEK 02 / PLAYGROUND</span><h1>글자 비가 내려요</h1><p>단어를 입력해 글자 비를 내려보세요.<br>아래 친구가 피할 수 있을까요?</p></div>
    <div class="typing-center"><p class="typing-caption">TYPE THE WORD</p><div class="typing-word" aria-live="polite"></div><p class="typing-feedback">보이는 단어를 그대로 입력해 주세요</p><label class="typing-input-label">여기에 단어를 입력하세요<input class="typing-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="화면에 보이는 단어 입력"></label></div>
    <div class="typing-score">WORDS <strong>0</strong></div>
    <div class="typing-cleaning-note" role="status" hidden>바닥이 가득 찼어요! 잠깐 청소할게요 🧹</div>
    <div class="typing-ground-label">LOOK OUT BELOW! <span>↗</span></div>
    <div class="typing-over" hidden><div class="typing-over-card"><span>OOPS!</span><h2>앗, 맞았다!</h2><p>총 <strong class="typing-final-score">0</strong>개의 단어를 떨어뜨렸어요.</p><button class="typing-restart" type="button">다시 시작하기 ↗</button></div></div>
  </main>`

type Letter = { text: string; x: number; y: number; vx: number; vy: number; angle: number; spin: number; size: number }
// Word length rises every three completed words. German compounds use only
// letters available on a standard English keyboard.
const wordLevels = [
  ['구름', '바다', '토끼', '별빛', '하늘', '마음', '우주', '사과', '나무', '행복', 'cat', 'sky', 'rain'],
  ['고양이', '디자인', '바닷가', 'coffee', 'hello', 'cloud', 'apple', 'smile', 'dream', 'pigeon', 'bubble'],
  ['sunshine', 'rainbow', 'fireworks', 'branding', 'beautiful', 'butterfly', 'adventure', 'happiness'],
  ['playground', 'watermelon', 'strawberry', 'kindergarten', 'schmetterling', 'freundschaft', 'arbeitsplatz'],
  ['miscommunication', 'incomprehensible', 'counterproductive', 'elektromagnetismus', 'zusammenarbeit', 'krankenversicherung'],
  ['internationalization', 'uncharacteristically', 'multidisciplinary', 'donaudampfschifffahrt', 'lebensversicherung', 'geschwindigkeitsbegrenzung'],
  ['lebensversicherungsgesellschaft', 'bundesverfassungsgericht', 'donaudampfschifffahrtsgesellschaft', 'rechtsschutzversicherungsgesellschaften'],
]
const sirenWords = ['donaudampfschifffahrtsgesellschaft', 'rechtsschutzversicherungsgesellschaften']
const normalized = (text: string) => text.normalize('NFKD').toLowerCase()

export class TypingGame {
  private root: HTMLElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private stonePattern: CanvasPattern | string
  private input: HTMLInputElement
  private wordView: HTMLElement
  private feedback: HTMLElement
  private scoreView: HTMLElement
  private overlay: HTMLElement
  private letters: Letter[] = []
  private pile: Letter[] = []
  private cleaning = false
  private cleaningTime = 0
  private elapsedForWord = 0
  private laughing = false
  private gettingUp = 0
  private siren = false
  private word = ''
  private score = 0
  private active = false
  private ended = false
  private composing = false
  private completing = false
  private width = 0
  private height = 0
  private personX = 0
  private personVelocity = 0
  private frame = 0
  private previousTime = 0
  private resizeObserver: ResizeObserver

  constructor(root: HTMLElement) {
    this.root = root
    this.canvas = root.querySelector('canvas')!
    this.ctx = this.canvas.getContext('2d')!
    const texture = document.createElement('canvas')
    texture.width = 96; texture.height = 96
    const textureCtx = texture.getContext('2d')!
    textureCtx.fillStyle = '#aaa9a0'; textureCtx.fillRect(0, 0, 96, 96)
    for (let i = 0; i < 400; i++) {
      textureCtx.fillStyle = i % 3 ? '#686c6528' : '#f5f3e740'
      const size = 1 + Math.random() * 4
      textureCtx.fillRect(Math.random() * 96, Math.random() * 96, size, size * .6)
    }
    this.stonePattern = this.ctx.createPattern(texture, 'repeat') ?? '#aaa9a0'

    this.input = root.querySelector('.typing-input')!
    this.wordView = root.querySelector('.typing-word')!
    this.feedback = root.querySelector('.typing-feedback')!
    this.scoreView = root.querySelector('.typing-score strong')!
    this.overlay = root.querySelector('.typing-over')!
    this.input.addEventListener('compositionstart', () => { this.composing = true })
    this.input.addEventListener('compositionend', () => { this.composing = false; if (!this.completing) this.checkInput() })
    this.input.addEventListener('input', () => this.checkInput())
    root.querySelector('.typing-restart')!.addEventListener('click', () => this.reset(true))
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(root)
    this.reset(false)
  }

  setActive(active: boolean) {
    this.active = active
    if (active) { this.resize(); this.previousTime = 0; this.frame = requestAnimationFrame(this.tick); if (!this.ended && !this.cleaning) this.input.focus({ preventScroll: true }) }
    else { cancelAnimationFrame(this.frame); this.input.blur() }
  }
  private resize() {
    const rect = this.root.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const oldWidth = this.width
    this.width = rect.width; this.height = rect.height
    const dpr = Math.min(devicePixelRatio || 1, 2)
    this.canvas.width = this.width * dpr; this.canvas.height = this.height * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.personX = oldWidth ? Math.min(this.width - 28, this.personX * this.width / oldWidth) : this.width / 2
  }
  private nextWord() {
    this.siren = Math.random() < .1
    const level = Math.min(wordLevels.length - 1, Math.floor(this.score / 3))
    const options = (this.siren ? sirenWords : wordLevels[level]).filter(word => word !== this.word)
    this.word = options[Math.floor(Math.random() * options.length)]
    this.elapsedForWord = 0
    this.laughing = false
    const intensity = Math.max(0, Math.min(1, (Array.from(this.word).length - 3) / 15))
    this.root.style.setProperty('--tension', String(intensity))
    this.root.style.setProperty('--shake-size', `${intensity * 4}px`)
    this.root.style.setProperty('--word-size', `clamp(18px, ${Math.min(9, 75 / this.word.length)}vw, 100px)`)
    this.root.dataset.siren = String(this.siren)
    this.input.value = ''
    this.feedback.textContent = '보이는 단어를 그대로 입력해 주세요'
    this.renderWord('')
  }
  private renderWord(value: string) {
    const typed = normalized(value)
    let offset = 0
    this.wordView.replaceChildren(...Array.from(this.word, char => {
      const span = document.createElement('span')
      const length = normalized(char).length
      const progress = Math.max(0, Math.min(1, (typed.length - offset) / length))
      span.textContent = char
      if (progress > 0) { span.className = progress === 1 ? 'typed' : 'typing-partial'; span.style.setProperty('--progress', `${progress * 100}%`) }
      offset += length
      return span
    }))
  }
  private checkInput() {
    if (!this.active || this.ended || this.cleaning || this.completing) return
    const value = this.input.value
    const typed = normalized(value)
    const target = normalized(this.word)
    if (!target.startsWith(typed)) {
      this.feedback.textContent = '앗, 제시된 단어만 입력할 수 있어요'
      if (!this.composing) { this.input.value = ''; this.renderWord('') }
      return
    }
    this.feedback.textContent = '좋아요! 계속 입력해 주세요'
    this.renderWord(value)
    if (typed === target) {
      // End Korean IME composition as soon as the complete word appears.
      if (this.composing) {
        this.completing = true
        this.input.blur()
        this.composing = false
      }
      if (this.laughing) this.gettingUp = .25
      this.dropWord()
      this.scoreView.textContent = String(++this.score)
      this.nextWord()
      if (this.completing) {
        this.completing = false
        if (this.active && !this.ended) this.input.focus({ preventScroll: true })
      }
    }
  }
  private dropWord() {
    const chars = Array.from(this.word)
    const center = this.width * (.2 + Math.random() * .6)
    chars.forEach((char, index) => {
      const size = (36 + Math.random() * 13) * 5
      this.letters.push({ text: char, x: Math.max(35, Math.min(this.width - 35, center + (index - (chars.length - 1) / 2) * 90)), y: -size * .75 - index * 110, vx: (Math.random() - .5) * 32, vy: 20 + Math.random() * 30, angle: (Math.random() - .5) * .6, spin: (Math.random() - .5) * 2, size })
    })
  }
  private reset(focus: boolean) {
    this.letters = []; this.pile = []; this.cleaning = false; this.cleaningTime = 0; this.gettingUp = 0; this.root.dataset.cleaning = 'false'; this.root.querySelector<HTMLElement>('.typing-cleaning-note')!.hidden = true; this.score = 0; this.ended = false; this.composing = false; this.personX = this.width / 2; this.personVelocity = 0
    this.overlay.hidden = true; this.scoreView.textContent = '0'; this.input.disabled = false
    this.nextWord()
    if (focus) this.input.focus({ preventScroll: true })
  }
  private tick = (time: number) => {
    if (!this.active) return
    const dt = this.previousTime ? Math.min((time - this.previousTime) / 1000, .04) : 0
    this.previousTime = time
    const ctx = this.ctx, w = this.width, h = this.height, ground = h - Math.max(45, h * .1)
    ctx.clearRect(0, 0, w, h)
    if (!this.ended && !this.cleaning) {
      this.elapsedForWord += dt
      // Give the player time to type before the character starts teasing.
      if (this.elapsedForWord >= 5 && !this.gettingUp) this.laughing = true
      this.gettingUp = Math.max(0, this.gettingUp - dt)
      // Look ahead at all approaching letters and run toward the nearest safe gap.
      const threats = this.letters.flatMap(letter => {
        const distance = ground - 70 - letter.y
        if (distance < -letter.size) return []
        const arrival = Math.max(0, (-letter.vy + Math.sqrt(letter.vy ** 2 + 500 * Math.max(0, distance))) / 250)
        if (arrival > 2.2) return []
        return [{ x: letter.x + letter.vx * arrival, arrival, radius: 23 + letter.size * .28 }]
      })
      let targetVelocity = 0
      if (threats.length && !this.laughing && !this.gettingUp) {
        let bestX = this.personX
        let bestCost = Infinity
        for (let x = 25; x <= w - 25; x += 20) {
          let cost = Math.abs(x - this.personX) * .16
          for (const threat of threats) {
            const distance = Math.abs(x - threat.x)
            if (distance < threat.radius + 20) cost += (threat.radius + 20 - distance) * (5 / (threat.arrival + .3))
          }
          if (cost < bestCost) { bestCost = cost; bestX = x }
        }
        if (Math.abs(bestX - this.personX) > 5) targetVelocity = Math.sign(bestX - this.personX) * Math.min(1250, 500 + this.score * 45)
      }
      this.personVelocity += (targetVelocity - this.personVelocity) * Math.min(1, dt * (14 + Math.min(this.score, 20)))
      this.personX = Math.max(25, Math.min(w - 25, this.personX + this.personVelocity * dt))
      const falling: Letter[] = []
      for (const letter of this.letters) {
        letter.vy += 250 * dt; letter.y += letter.vy * dt; letter.x += letter.vx * dt; letter.angle += letter.spin * dt
        if (Math.abs(letter.x - this.personX) < 23 + letter.size * .28 && letter.y + letter.size * .35 > ground - 92 && letter.y - letter.size * .35 < ground - 5) this.gameOver()
        if (letter.y + letter.size * .35 >= ground) this.landLetter(letter, ground)
        else falling.push(letter)
      }
      this.letters = falling
      // Three layers across the available floor make a full room.
      if (!this.ended && this.pile.length >= Math.max(6, Math.floor(w / 150) * 3)) this.startCleaning()
    }
    if (this.cleaning) this.updateCleaning(dt, ground)
    ctx.strokeStyle = '#d6cec0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, ground); ctx.lineTo(w, ground); ctx.stroke()
    if (this.cleaning) {
      ctx.fillStyle = '#343c37'; ctx.beginPath(); ctx.ellipse(w - 45, ground + 1, 27, 8, 0, 0, Math.PI * 2); ctx.fill()
    }
    for (const l of [...this.pile, ...this.letters]) { ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.angle); ctx.fillStyle = this.stonePattern; ctx.strokeStyle = '#777972'; ctx.lineWidth = Math.max(2, l.size * .018); ctx.lineJoin = 'round'; ctx.font = `800 ${l.size}px Inter, Pretendard, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeText(l.text, 0, 0); ctx.fillText(l.text, 0, 0); ctx.restore() }
    this.drawPerson(ctx, ground, time)
    this.frame = requestAnimationFrame(this.tick)
  }
  private landLetter(letter: Letter, ground: number) {
    const columns = Math.max(1, Math.floor(this.width / 150))
    const column = Math.max(0, Math.min(columns - 1, Math.floor(letter.x / this.width * columns)))
    const layer = this.pile.filter(item => Math.floor(item.x / this.width * columns) === column).length
    letter.x = (column + .5) * this.width / columns
    letter.y = ground - letter.size * .38 - Math.min(layer, 5) * letter.size * .55
    letter.angle = Math.max(-.45, Math.min(.45, letter.angle))
    this.pile.push(letter)
  }
  private startCleaning() {
    this.cleaning = true; this.cleaningTime = 0; this.laughing = false; this.personVelocity = 0
    this.root.dataset.cleaning = 'true'
    this.root.querySelector<HTMLElement>('.typing-cleaning-note')!.hidden = false
    this.input.disabled = true
  }
  private updateCleaning(dt: number, ground: number) {
    this.cleaningTime += dt
    const progress = Math.min(1, this.cleaningTime / 7)
    const hole = this.width - 45
    this.personX = 30 + progress * Math.max(0, hole - 65)
    for (const letter of this.pile) {
      if (letter.x < this.personX + 35) {
        letter.x += Math.max(90, (hole - letter.x) * 1.6) * dt
        letter.y += (ground - 8 - letter.y) * Math.min(1, dt * 3)
        letter.angle += dt * 2
      }
    }
    this.pile = this.pile.filter(letter => letter.x < hole - 12)
    if (progress >= 1) {
      this.pile = []; this.cleaning = false; this.root.dataset.cleaning = 'false'
      this.root.querySelector<HTMLElement>('.typing-cleaning-note')!.hidden = true
      this.input.disabled = false
      this.elapsedForWord = 0
      if (this.active) this.input.focus({ preventScroll: true })
    }
  }
  private drawPerson(ctx: CanvasRenderingContext2D, ground: number, time: number) {
    const moving = Math.abs(this.personVelocity) > 20
    const running = moving || this.cleaning
    const cycle = time / (this.cleaning ? 150 : 80)
    const swing = running ? Math.sin(cycle) : 0
    ctx.save(); ctx.translate(this.personX, ground)
    if (this.laughing) {
      const laughingTime = this.elapsedForWord - 5
      if (laughingTime > 1.7) { ctx.translate(Math.sin(time / 220) * 15, -18); ctx.rotate(Math.PI / 2 + Math.sin(time / 160) * .7) }
      else { ctx.translate(0, Math.sin(time / 90) * 3); ctx.rotate(Math.sin(time / 100) * .18) }
    } else if (this.gettingUp) { ctx.rotate(this.gettingUp * .9); ctx.translate(0, -this.gettingUp * 10) }
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.fillStyle = '#d4c8b7'; ctx.beginPath(); ctx.ellipse(0, 1, 24, 4, 0, 0, Math.PI * 2); ctx.fill()
    type Point = [number, number]
    // Each segment starts at the end of its parent, so joints actually rotate.
    const segment = (start: Point, length: number, angle: number): Point => [
      start[0] + Math.sin(angle) * length, start[1] + Math.cos(angle) * length,
    ]
    const limb = (points: Point[], color: string, width: number) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(...points[0])
      for (const point of points.slice(1)) ctx.lineTo(...point)
      ctx.stroke()
    }
    const leg = (side: -1 | 1) => {
      const phase = swing * side
      const hip: Point = [side * 7, -29]
      const thighAngle = running ? phase * .85 : side * .12
      const kneeAngle = running ? Math.max(0, -phase) * 1.25 : .08
      const knee = segment(hip, 13, thighAngle)
      const ankle = segment(knee, 14, thighAngle + kneeAngle)
      const toe = segment(ankle, 8, Math.PI / 2 + (running ? -phase * .35 : 0))
      limb([hip, knee, ankle], '#3b4546', 7)
      limb([ankle, toe], '#313a39', 5)
    }
    leg(-1); leg(1)
    ctx.fillStyle = '#7f9d8c'; ctx.beginPath(); ctx.roundRect(-17, -59, 34, 35, 12); ctx.fill()
    const arm = (side: -1 | 1): Point => {
      const shoulder: Point = [side * 14, -52]
      const phase = swing * side
      let shoulderAngle = side * .55 - phase * .8
      let elbowAngle = -side * (.35 + (running ? (1 + phase) * .35 : .15))
      if (this.laughing) { shoulderAngle = side * .8; elbowAngle = -side * 1.9 }
      if (this.cleaning) { shoulderAngle = side * .4 + .55 + Math.sin(cycle) * .25; elbowAngle = -side * .6 }
      const elbow = segment(shoulder, 13, shoulderAngle)
      const wrist = segment(elbow, 13, shoulderAngle + elbowAngle)
      const hand = segment(wrist, 4, shoulderAngle + elbowAngle + phase * .25)
      limb([shoulder, elbow, wrist], '#648273', 7)
      limb([wrist, hand], '#f0cbb0', 6)
      return hand
    }
    arm(-1)
    const rightHand = arm(1)
    ctx.fillStyle = '#f0cbb0'; ctx.beginPath(); ctx.arc(0, -72, 17, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#394244'; ctx.beginPath(); ctx.arc(0, -76, 17, Math.PI, Math.PI * 2); ctx.lineTo(17, -76); ctx.quadraticCurveTo(6, -88, -15, -76); ctx.fill()
    if (this.laughing) { ctx.fillStyle = '#d77966'; ctx.font = 'bold 15px sans-serif'; ctx.fillText('하하!', 18, -90) }
    ctx.fillStyle = '#394244'; ctx.beginPath(); ctx.arc(-6, -76, 1.7, 0, Math.PI * 2); ctx.arc(6, -76, 1.7, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#a57465'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, -68, 3, .1, Math.PI - .1); ctx.stroke()
    if (this.cleaning) {
      const sweep = Math.sin(time / 130) * 7
      ctx.strokeStyle = '#9c7653'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(...rightHand); ctx.lineTo(40 + sweep, -5); ctx.stroke()
      ctx.fillStyle = '#cfa867'; ctx.beginPath(); ctx.moveTo(35 + sweep, -12); ctx.lineTo(45 + sweep, -10); ctx.lineTo(55 + sweep, -1); ctx.lineTo(32 + sweep, -1); ctx.closePath(); ctx.fill()
    }
    ctx.restore()
  }
  private gameOver() {
    if (this.ended) return
    this.ended = true; this.input.disabled = true
    this.root.querySelector('.typing-final-score')!.textContent = String(this.score)
    this.overlay.hidden = false
    this.root.querySelector<HTMLButtonElement>('.typing-restart')!.focus({ preventScroll: true })
  }
}
