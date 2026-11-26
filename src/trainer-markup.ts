import { trainerTitle } from './trainer-core.ts'

export const trainerMarkup = `<main id="page-fourteenth" class="trainer-page app-page" data-facing="user" hidden>
  <video class="trainer-camera" muted playsinline aria-label="내 포켓몬의 실시간 카메라 영상"></video>
  <div class="trainer-stage" hidden>
    <article class="trainer-vitals enemy"><span>상대 트레이너</span><strong class="trainer-enemy-name">인간1</strong><meter class="trainer-enemy-hp" min="0" max="100" low="26" high="60" optimum="100" value="100" aria-label="상대 HP"></meter><small class="trainer-enemy-number">HP 100 / 100</small></article>
    <div class="trainer-opponent" aria-hidden="true"><div class="trainer-portrait"><canvas class="trainer-person"></canvas><canvas class="trainer-hurt"></canvas></div><i class="trainer-orb"></i></div>
    <article class="trainer-vitals player"><span>내 포켓몬</span><strong>나</strong><meter class="trainer-player-hp" min="0" max="100" low="26" high="60" optimum="100" value="100" aria-label="내 HP"></meter><small class="trainer-player-number">HP 100 / 100</small></article>
    <div class="trainer-motion" aria-hidden="true"></div>
    <section class="trainer-console" aria-label="배틀">
      <div class="trainer-dialogue"><p class="trainer-message" role="status"></p></div>
      <div class="trainer-actions" hidden>
        <button type="button" data-trainer-action="fight"><span>↗</span> 싸운다</button>
        <button type="button" data-trainer-action="heal"><span>+</span> 치유한다</button>
        <button type="button" data-trainer-action="run"><span>←</span> 도망간다</button>
        <button type="button" data-trainer-action="catch" hidden><span>◉</span> 포획한다</button>
      </div>
      <button class="trainer-return" type="button" hidden>카메라로 돌아가기</button>
    </section>
  </div>
  <div class="trainer-field" hidden>
    <i class="trainer-tip" hidden aria-hidden="true"></i>
    <i class="trainer-impact" hidden aria-hidden="true"></i>
    <button class="trainer-throw" type="button" aria-label="포획구 던지기" aria-describedby="trainer-throw-help"><span class="trainer-orb" aria-hidden="true"></span></button>
    <p id="trainer-throw-help" class="trainer-field-note" role="status">포획구를 위로 쓸어 던지세요. 사람에게 닿는 순간 찰칵!</p>
  </div>
  <div class="trainer-tools">
    <button class="trainer-boxes" type="button">인벤토리 <span>0</span></button>
    <div class="trainer-camera-controls">
      <button class="trainer-flip" type="button" hidden>후면 카메라로 전환</button>
      <button class="trainer-stop" type="button" hidden>카메라 끄기</button>
      <p class="trainer-camera-status" role="status"></p>
    </div>
  </div>
  <div class="trainer-entry">
    <section><h1>${trainerTitle}</h1><p>카메라 속 내가 포켓몬이 된다. 포획구를 던져 배틀을 시작하세요.</p>
    <button class="trainer-start" type="button">카메라 켜기</button><p class="trainer-error" role="status"></p></section>
  </div>
  <div class="trainer-ar" hidden aria-label="카메라에 인간 배치하기">
    <video muted playsinline hidden aria-hidden="true"></video>
    <button class="trainer-ar-surface" type="button" aria-label="화면에 배치" hidden></button>
    <div class="trainer-ar-avatar" hidden><img alt=""><strong></strong></div>
    <a class="trainer-ar-quick-look" rel="ar" download="captured-person.usdz" aria-label="AR로 열기" aria-disabled="true" hidden><img alt=""></a>
    <p role="status"></p>
    <button class="trainer-ar-close" type="button">닫기</button>
    <button class="trainer-ar-place" type="button" hidden>여기에 놓기</button>
  </div>
  <dialog class="trainer-capture-result" aria-labelledby="trainer-capture-message" aria-describedby="trainer-capture-note">
    <div class="trainer-capture-display"><canvas aria-hidden="true"></canvas></div>
    <div class="trainer-capture-dialogue">
      <div><h2 id="trainer-capture-message"></h2><p id="trainer-capture-note"></p></div>
      <form method="dialog"><button type="submit" autofocus>확인 <span aria-hidden="true">▾</span></button></form>
    </div>
  </dialog>
  <dialog class="trainer-inventory" aria-labelledby="trainer-inventory-title">
    <div class="trainer-inventory-head"><h2 id="trainer-inventory-title">인벤토리</h2><form method="dialog"><button type="submit">닫기</button></form></div>
    <h3>팀 <small class="trainer-team-count"></small></h3><ol class="trainer-team"></ol>
    <h3>보관함</h3><ol class="trainer-box"></ol>
  </dialog>
</main>`
