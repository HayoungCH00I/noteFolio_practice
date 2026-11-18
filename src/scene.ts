import type { Fireworks } from './fireworks.ts'

type Mode = 'night' | 'day'

export class StageScene {
  private mode: Mode = 'night'
  private changing = false
  private root: HTMLElement
  private effects: Fireworks
  private button: HTMLButtonElement

  constructor(root: HTMLElement, effects: Fireworks) {
    this.root = root
    this.effects = effects
    this.button = root.querySelector<HTMLButtonElement>('#change-scene')!
    this.button.addEventListener('click', () => this.turn())
    effects.onStir = () => this.turn()
  }

  private makeArt(mode: Mode, offset: number, width: number, height: number, starSnapshot: string) {
    const original = this.root.querySelector<HTMLElement>(`.${mode}-scene`)!
    const art = original.cloneNode(true) as HTMLElement
    art.classList.add('stage-art')
    art.style.width = `${width}px`
    art.style.height = `${height}px`
    art.style.left = `${-offset}px`
    art.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'))
    const clonedStars = art.querySelector('canvas')
    if (clonedStars) {
      const image = document.createElement('img')
      image.src = starSnapshot
      image.className = 'stage-stars'
      image.alt = ''
      clonedStars.replaceWith(image)
    }
    return art
  }

  private turn() {
    if (this.changing) return
    this.changing = true
    this.button.disabled = true
    this.effects.setTransitioning(true)
    const next: Mode = this.mode === 'night' ? 'day' : 'night'
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.root.classList.add('is-changing')
    const stage = document.createElement('div')
    stage.className = 'stage'
    stage.setAttribute('aria-hidden', 'true')
    const { width, height } = this.root.getBoundingClientRect()
    const count = 12
    const starSnapshot = this.root.querySelector<HTMLCanvasElement>('#stars')!.toDataURL()
    for (let i = 0; i < count; i++) {
      const slot = document.createElement('div')
      slot.className = 'stage-slot'
      const panel = document.createElement('div')
      panel.className = 'stage-panel'
      panel.style.setProperty('--delay', `${reduced ? 0 : i * 65}ms`)
      for (const [mode, side] of [[this.mode, 'front'], [next, 'back']] as const) {
        const face = document.createElement('div')
        face.className = `stage-face stage-${side}`
        face.append(this.makeArt(mode, width * i / count, width, height, starSnapshot))
        panel.append(face)
      }
      slot.append(panel)
      stage.append(slot)
    }
    this.root.append(stage)
    let finished = false
    let timer = 0
    const finish = () => {
      if (finished) return
      finished = true
      window.clearTimeout(timer)
      this.mode = next
      this.root.classList.toggle('is-day', next === 'day')
      this.updateCopy()
      this.effects.setScene(next)
      stage.remove()
      this.root.classList.remove('is-changing')
      this.effects.setTransitioning(false)
      this.button.disabled = false
      this.changing = false
    }
    const last = stage.querySelector('.stage-slot:last-child .stage-panel')!
    last.addEventListener('animationend', (event) => { if (event.target === last) finish() }, { once: true })
    window.setTimeout(() => {
      this.root.classList.toggle('is-day', next === 'day')
      stage.classList.add('is-turning')
      // Fallback also completes the scene when animation events are throttled.
      timer = window.setTimeout(finish, reduced ? 220 : 1850)
    }, reduced ? 30 : 230)
  }

  private updateCopy() {
    const day = this.mode === 'day'
    this.root.querySelector('h1')!.textContent = day ? '출근하는 낮' : '배고픈 밤'
    this.root.querySelector('.eyebrow')!.textContent = day ? '다시, 하루가 날아오르는 시간' : '잠들기엔 조금 아쉬운 시간'
    this.root.querySelector('.subtitle')!.textContent = day ? '바쁜 발걸음 사이로, 가벼운 날갯짓 하나.' : '허기진 마음에, 작은 불꽃 하나.'
    this.root.querySelector('.invitation')!.innerHTML = day ? '하늘에 작은 날갯짓을 남겨보세요 <span aria-hidden="true">↗</span>' : '밤하늘에 당신만의 빛을 남겨보세요 <span aria-hidden="true">↗</span>'
    this.root.querySelector('#instructions')!.innerHTML = day
      ? '<span><i aria-hidden="true">♧</i> 클릭하면 비둘기</span><span><i aria-hidden="true">◉</i> 꾹 누르면 더 많이</span><span><i aria-hidden="true">〰</i> 드래그하면 줄지어</span>'
      : '<span><i aria-hidden="true">✦</i> 클릭하면 폭죽</span><span><i aria-hidden="true">◉</i> 꾹 누르면 더 크게</span><span><i aria-hidden="true">〰</i> 드래그하면 연속으로</span>'
    this.root.querySelector('#scene-hint')!.textContent = day ? '마우스나 스크롤을 빠르게 휘저으면 밤으로' : '마우스나 스크롤을 빠르게 휘저으면 낮으로'
    this.button.innerHTML = day ? '밤으로 돌아가기 <span aria-hidden="true">↶</span>' : '낮으로 넘기기 <span aria-hidden="true">↗</span>'
    this.root.querySelector('#fireworks')!.setAttribute('aria-label', day ? '비둘기가 날아오르는 낮 하늘' : '인터랙티브 폭죽 밤하늘')
    this.root.querySelector('#keyboard-help')!.textContent = day ? '하늘에 초점을 맞춘 뒤 스페이스 또는 엔터를 누르세요. 오래 누를수록 더 많은 비둘기가 날아오릅니다.' : '하늘에 초점을 맞춘 뒤 스페이스 또는 엔터를 누르세요. 오래 누를수록 큰 폭죽이 터집니다.'
    this.root.querySelector('#announcement')!.textContent = day ? '아침이 되었습니다. 출근하는 낮, 비둘기들이 기다립니다.' : '다시 배고픈 밤이 되었습니다.'
    if (!this.root.hidden) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', day ? '#b8ddeb' : '#070d1e')
  }
}
