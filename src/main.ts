import { choirMarkup } from './choir-markup.ts'
import { snowMarkup } from './snow-markup.ts'
import { FruitSlash, fruitSlashMarkup } from './fruit-slash.ts'
import { companyMarkup } from './company-markup.ts'
import { deferredScene } from './deferred-scene.ts'
import './style.css'
import { clawMarkup } from './claw-markup.ts'
import { Fireworks } from './fireworks.ts'
import { StageScene } from './scene.ts'
import { BubbleWrap } from './bubble-wrap.ts'
import { setupPages } from './pages.ts'
import { MonologueScene, monologueMarkup } from './monologue.ts'
import { CatScene, catMarkup } from './cat.ts'
import { CharacterScene, characterMarkup } from './character.ts'
import { TypingGame, typingGameMarkup } from './typing-game.ts'
import usagiSoundUrl from './assets/chiikawa-usagi-una.mp3'
import usagiHuhUrl from './assets/chiikawa-usagi-huh.mp3'
import usagiYaaahUrl from './assets/usagi-yaaahaaaaa.mp3'
import usagiYahUrl from './assets/usagi-yahaaaaaa.mp3'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <nav class="page-nav" aria-label="작업실 페이지 선택">
    <div class="week-nav" aria-label="주차 선택"><button type="button" data-week="1" aria-pressed="true">1주차</button><button type="button" data-week="2" aria-pressed="false">2주차</button><button type="button" data-week="3" aria-pressed="false">3주차</button></div>
    <div class="page-nav-links">
    <button type="button" data-page="first" aria-controls="page-first" aria-current="page"><span aria-hidden="true">01</span> 첫번째로 만든거</button>
    <button type="button" data-page="second" aria-controls="page-second"><span aria-hidden="true">02</span> 두번째로 만든거</button>
    <button type="button" data-page="third" aria-controls="page-third"><span aria-hidden="true">03</span> 세번째로 만든거</button>
    <button type="button" data-page="fourth" aria-controls="page-fourth"><span aria-hidden="true">04</span> 나만의 페이지</button>
    <button type="button" data-page="fifth" aria-controls="page-fifth"><span aria-hidden="true">05</span> 고양이 만지기</button>
    <button type="button" data-page="sixth" aria-controls="page-sixth" hidden><span aria-hidden="true">01</span> 글자 비 게임</button>
    <button type="button" data-page="seventh" aria-controls="page-seventh" hidden><span aria-hidden="true">02</span> 인형뽑기</button>
    <button type="button" data-page="eighth" aria-controls="page-eighth" hidden><span aria-hidden="true">03</span> 회사</button>
    <button type="button" data-page="ninth" aria-controls="page-ninth" hidden><span aria-hidden="true">08</span> Ninja Fruit Slash</button>
    <button type="button" data-page="tenth" aria-controls="page-tenth" hidden><span aria-hidden="true">09</span> Snow</button>
    <button type="button" data-page="eleventh" aria-controls="page-eleventh" hidden><span aria-hidden="true">FREE</span> 합창단</button>
    </div>
  </nav>
  <main class="night app-page" id="page-first">
    <div class="scenery night-scene">
    <canvas id="stars" aria-hidden="true"></canvas>
    <div class="moon" aria-hidden="true"></div>
    <div class="mist mist-back" aria-hidden="true"></div>
    <div class="mist mist-front" aria-hidden="true"></div>
    <svg class="landscape" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true">
      <path fill="#10172b" d="M0 140 Q100 95 230 144 T470 136 T720 156 T1020 127 T1260 138 T1440 120 V220 H0Z"/>
      <path fill="#0a1020" d="M0 175 Q160 115 340 173 T670 166 T1000 177 T1280 154 T1440 167 V220 H0Z"/>
      <path fill="#070d19" d="M0 194 Q180 169 350 195 T740 190 T1090 201 T1440 184 V220 H0Z"/>
    </svg>
    </div>
    <div class="scenery day-scene" aria-hidden="true">
      <div class="sun"></div>
      <div class="day-cloud cloud-one"></div>
      <div class="day-cloud cloud-two"></div>
      <div class="day-cloud cloud-three"></div>
      <svg class="city" viewBox="0 0 1440 240" preserveAspectRatio="none">
        <path fill="#acc6cd" d="M0 240V150H60V110H100V150H155V80H202V140H265V115H310V165H360V95H405V130H480V65H525V140H590V90H650V155H720V110H780V70H820V140H890V105H940V160H995V85H1045V130H1110V60H1160V145H1210V110H1260V160H1320V95H1380V140H1440V240Z"/>
        <path fill="#86a6b0" d="M0 240V190H100V165H160V200H240V145H290V180H350V155H410V205H490V160H550V185H620V140H670V195H760V160H820V180H900V145H970V195H1050V165H1110V200H1190V140H1240V175H1330V155H1390V185H1440V240Z"/>
      </svg>
    </div>
    <svg class="filter-defs" aria-hidden="true" width="0" height="0">
      <defs>
        <filter id="cloud-letters" x="-20%" y="-40%" width="140%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="3" seed="8" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" result="letters" />
          <feGaussianBlur in="letters" stdDeviation="0.65" result="soft-letters" />
          <feDiffuseLighting in="noise" surfaceScale="3" diffuseConstant="1" lighting-color="#dce6f7" result="cloud-light">
            <feDistantLight azimuth="235" elevation="50" />
          </feDiffuseLighting>
          <feComposite in="cloud-light" in2="soft-letters" operator="in" result="cloud-texture" />
          <feGaussianBlur in="soft-letters" stdDeviation="2.5" result="halo" />
          <feMerge><feMergeNode in="halo" /><feMergeNode in="cloud-texture" /></feMerge>
        </filter>
      </defs>
    </svg>
    <header class="topbar">
      <div class="wordmark"><span class="brand-star" aria-hidden="true">✳</span> 하늘 작업실</div>
      <div class="night-label"><span></span> A LITTLE MAGIC, BY YOU</div>
    </header>
    <div class="cloud-title">
      <p class="eyebrow">잠들기엔 조금 아쉬운 시간</p>
      <h1>배고픈 밤</h1>
      <p class="subtitle">허기진 마음에, 작은 불꽃 하나.</p>
    </div>
    <canvas id="fireworks" tabindex="0" role="application" aria-label="인터랙티브 폭죽 밤하늘" aria-describedby="instructions keyboard-help"></canvas>
    <div class="bottom-ui">
      <p class="invitation">밤하늘에 당신만의 빛을 남겨보세요 <span aria-hidden="true">↗</span></p>
      <div class="instructions" id="instructions">
        <span><i aria-hidden="true">✦</i> 클릭하면 폭죽</span>
        <span><i aria-hidden="true">◉</i> 꾹 누르면 더 크게</span>
        <span><i aria-hidden="true">〰</i> 드래그하면 연속으로</span>
      </div>
      <div class="footer-line"><span id="scene-hint">마우스나 스크롤을 빠르게 휘저으면 낮으로</span><div class="footer-actions"><button type="button" id="change-scene">낮으로 넘기기 <span aria-hidden="true">↗</span></button><button type="button" id="clear-sky">하늘 비우기 <span aria-hidden="true">↺</span></button></div></div>
    </div>
    <p id="announcement" class="sr-only" role="status" aria-live="polite"></p>
    <p class="sr-only" id="keyboard-help">키보드로는 밤하늘에 초점을 맞춘 뒤 스페이스 또는 엔터를 누르세요. 오래 누를수록 큰 폭죽이 터집니다.</p>
  </main>
  <main class="bubble-page app-page" id="page-second" hidden>
    <div class="bubble-field" role="group" aria-label="화면 가득한 뽁뽁이" aria-describedby="bubble-help"></div>
    <div class="bubble-brand" aria-hidden="true"><span>◌</span> 작은 쉼표 작업실</div>
    <div class="bubble-note">
      <p class="bubble-kicker">A LITTLE POP, A LITTLE PAUSE</p>
      <h1>뽁, 하고 쉬어가요.</h1>
      <p id="bubble-help">클릭하거나 쓸어보세요. 터진 자리엔 천천히 공기가 돌아와요.</p>
      <p class="sr-only">방향키로 뽁뽁이를 선택하고 엔터 또는 스페이스로 터뜨릴 수 있습니다.</p>
    </div>
    <footer class="bubble-footer">
      <div class="pop-tally"><span class="tally-dot" aria-hidden="true"></span><strong id="pop-count">0</strong><span>번의 작은 해방</span></div>
      <button type="button" id="bubble-sound" aria-label="뽁뽁이 소리" aria-pressed="true">소리 켜짐 ♪</button>
    </footer>
  </main>
  ${characterMarkup}
  ${monologueMarkup}
  ${catMarkup}
  ${typingGameMarkup}
  ${clawMarkup}
  ${companyMarkup}
  ${fruitSlashMarkup}
  ${snowMarkup}
  ${choirMarkup}
`

const effects = new Fireworks(
  document.querySelector<HTMLCanvasElement>('#fireworks')!,
  document.querySelector<HTMLCanvasElement>('#stars')!,
  document.querySelector<HTMLButtonElement>('#clear-sky')!,
  document.querySelector<HTMLParagraphElement>('#announcement')!,
)

new StageScene(document.querySelector<HTMLElement>('.night')!, effects)

const bubbles = new BubbleWrap(document.querySelector<HTMLElement>('#page-second')!)
const character = new CharacterScene(document.querySelector<HTMLElement>('#page-third')!, [usagiSoundUrl, usagiHuhUrl, usagiYaaahUrl, usagiYahUrl])
const monologue = new MonologueScene(document.querySelector<HTMLElement>('#page-fourth')!)
const cat = new CatScene(document.querySelector<HTMLElement>('#page-fifth')!, document.querySelector<HTMLButtonElement>('[data-page="fifth"]')!)
const typingGame = new TypingGame(document.querySelector<HTMLElement>('#page-sixth')!)
const clawRoot = document.querySelector<HTMLElement>('#page-seventh')!
const clawGame = deferredScene(clawRoot, async () => { const { ClawGame } = await import('./claw-game.ts'); return new ClawGame(clawRoot) })
const companyRoot = document.querySelector<HTMLElement>('#page-eighth')!
const company = deferredScene(companyRoot, async () => { const { CompanyScene } = await import('./company.ts'); return new CompanyScene(companyRoot) })
const fruitSlash = new FruitSlash(document.querySelector<HTMLElement>('#page-ninth')!)
const snowRoot = document.querySelector<HTMLElement>('#page-tenth')!
const snow = deferredScene(snowRoot, async () => { const { SnowScene } = await import('./snow.ts'); return new SnowScene(snowRoot) })
const choirRoot = document.querySelector<HTMLElement>('#page-eleventh')!
const choir = deferredScene(choirRoot, async () => { const { ChoirScene } = await import('./choir.ts'); return new ChoirScene(choirRoot) })
setupPages(effects, bubbles, character, monologue, cat, typingGame, clawGame, company, fruitSlash, snow, choir)
