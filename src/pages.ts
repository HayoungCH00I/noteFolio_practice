import { poseWallTitle } from './pose-wall-core.ts'
import { trainerTitle } from './trainer-core.ts'
import type { ChoirScene } from './choir.ts'
import type { SnowScene } from './snow.ts'
import type { FruitSlash } from './fruit-slash.ts'
import type { CompanyScene } from './company.ts'
import type { ClawGame } from './claw-game.ts'
import type { Fireworks } from './fireworks.ts'
import type { BubbleWrap } from './bubble-wrap.ts'
import type { CharacterScene } from './character.ts'
import type { MonologueScene } from './monologue.ts'
import type { CatScene } from './cat.ts'
import type { TypingGame } from './typing-game.ts'

export const pageKeys = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth'] as const
export type PageKey = typeof pageKeys[number]
export function weekForPage(page: PageKey) { return page === 'sixteenth' ? '5' : ['twelfth', 'thirteenth', 'fourteenth', 'fifteenth'].includes(page) ? '4' : (page === 'ninth' || page === 'tenth' || page === 'eleventh') ? '3' : ['sixth', 'seventh', 'eighth'].includes(page) ? '2' : '1' }
export function pageFromHash(hash: string): PageKey {
  const key = hash.replace(/^#/, '')
  return pageKeys.includes(key as PageKey) ? key as PageKey : 'first'
}

export function setupPages(effects: Fireworks, bubbles: BubbleWrap, character: CharacterScene, monologue: MonologueScene, cat: CatScene, typingGame: TypingGame, clawGame: Pick<ClawGame, 'setActive'>, company: Pick<CompanyScene, 'setActive'>, fruitSlash: FruitSlash, snow: Pick<SnowScene, 'setActive'>, choir: Pick<ChoirScene, 'setActive'>, rubber: { setActive(active: boolean): void }, minecraft: { setActive(active: boolean): void }, trainer: { setActive(active: boolean): void }, poseWall: { setActive(active: boolean): void }, habitat: { setActive(active: boolean): void }) {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.page-nav [data-page]')]
  const titles: Record<PageKey, string> = {
    first: '배고픈 밤 · 출근하는 낮', second: '뽁뽁이 작업실', third: '작은 눈맞춤 · 우사기의 윙크', fourth: '나만의 페이지 · 브랜딩 디자이너의 TMI', fifth: '고양이 만지기 · 말랑한 시간', sixth: '글자 비 게임', seventh: '인형뽑기 · The Plush Club', eighth: '회사 · 오늘도 갓생', ninth: 'Ninja Fruit Slash · 손끝으로 싹', tenth: 'Snow · 내 방에 내리는 겨울', eleventh: '나의 작은 합창단 · 두 손으로 맞추는 목소리', twelfth: '고무 인간', thirteenth: 'MineCraft', fourteenth: trainerTitle, fifteenth: poseWallTitle, sixteenth: '우리 동네 걷기',
  }
  const show = () => {
    const page = pageFromHash(window.location.hash)
    const week = weekForPage(page)
    for (const key of pageKeys) document.querySelector<HTMLElement>(`#page-${key}`)!.hidden = key !== page
    document.body.dataset.page = page
    for (const button of buttons) {
      button.hidden = weekForPage(button.dataset.page as PageKey) !== week
      if (button.dataset.page === page) button.setAttribute('aria-current', 'page')
      else button.removeAttribute('aria-current')
    }
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-week]')) button.setAttribute('aria-pressed', String(button.dataset.week === week))
    effects.setActive(page === 'first')
    bubbles.setActive(page === 'second')
    character.setActive(page === 'third')
    monologue.setActive(page === 'fourth')
    cat.setActive(page === 'fifth')
    typingGame.setActive(page === 'sixth')
    clawGame.setActive(page === 'seventh')
    company.setActive(page === 'eighth')
    fruitSlash.setActive(page === 'ninth')
    snow.setActive(page === 'tenth')
    choir.setActive(page === 'eleventh')
    rubber.setActive(page === 'twelfth')
    minecraft.setActive(page === 'thirteenth')
    trainer.setActive(page === 'fourteenth')
    poseWall.setActive(page === 'fifteenth')
    habitat.setActive(page === 'sixteenth')
    document.title = titles[page]
    const night = document.querySelector('#page-first')!
    const color = page === 'sixteenth' ? '#111d2b' : page === 'fifteenth' ? '#153d38' : page === 'fourteenth' ? '#142b31' : page === 'twelfth' ? '#302438' : page === 'eleventh' ? '#eae2d5' : page === 'tenth' ? '#243a4c' : page === 'ninth' ? '#111725' : page === 'seventh' ? '#090d1b' : page === 'second' ? '#dce7eb' : page === 'third' ? '#eeefea' : page === 'fourth' ? '#f4f1e8' : page === 'sixth' ? '#f6f2e9' : page === 'fifth' ? '#f6f1e8' : night.classList.contains('is-day') ? '#b8ddeb' : '#070d1e'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
  }
  const menu = document.querySelector<HTMLDetailsElement>('.page-menu')!
  for (const button of buttons) button.addEventListener('click', () => { window.location.hash = button.dataset.page!; menu.open = false; menu.querySelector('summary')?.focus() })
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-week]')) button.addEventListener('click', () => { window.location.hash = button.dataset.week === '5' ? 'sixteenth' : button.dataset.week === '4' ? 'twelfth' : button.dataset.week === '3' ? 'ninth' : button.dataset.week === '2' ? 'sixth' : 'first' })
  window.addEventListener('hashchange', show)
  show()
}
