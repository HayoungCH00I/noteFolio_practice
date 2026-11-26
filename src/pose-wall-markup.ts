import { allowedMisses, poseWallTitle } from './pose-wall-core.ts'

export const poseWallMarkup = `
  <main id="page-fifteenth" class="pose-wall-page app-page" hidden>
    <div class="pose-wall-view" aria-hidden="true">
      <video class="pose-wall-camera" autoplay muted playsinline></video>
      <canvas class="pose-wall-3d"></canvas>
      <canvas class="pose-wall-person" hidden></canvas>
      <canvas class="pose-wall-contour"></canvas>
      <canvas class="pose-wall-floor" hidden></canvas>
      <div class="pose-wall-flash"></div>
    </div>
    <section class="pose-wall-entry">
      <div class="pose-wall-entry-copy">
        <h1>${poseWallTitle}</h1>
        <p>카메라를 정면에 고정하고 뒤로 물러나세요.<br>전신이 들어오면 연습이 자동으로 시작돼요.</p>
        <div class="pose-wall-starts" role="group" aria-label="플레이 인원">
          <button class="pose-wall-start" type="button" data-players="1" aria-label="카메라 켜고 1인 모드 시작">1인 시작</button>
          <button class="pose-wall-start" type="button" data-players="2" aria-label="카메라 켜고 2인 모드 시작">2인 시작</button>
        </div>
        <p class="pose-wall-error" role="status"></p>
      </div>
      <div class="pose-wall-illustration" aria-hidden="true"><div class="pose-wall-bricks"><span></span></div></div>
    </section>
    <div class="pose-wall-play" hidden>
      <header class="pose-wall-hud">
        <div><span>통과</span> <strong class="pose-wall-score">0</strong></div>
        <div><span>충돌</span> <strong class="pose-wall-misses">0 / ${allowedMisses + 1}</strong></div>
        <div class="pose-wall-practice">연습</div>
        <button type="button" class="pose-wall-flip">후면 전환</button>
        <button type="button" class="pose-wall-stop">그만하기</button>
        <p class="pose-wall-camera-status" role="status"></p>
      </header>
      <aside class="pose-wall-coach" aria-label="따라 할 자세" hidden>
        <canvas aria-hidden="true"></canvas>
        <div class="pose-wall-coach-statuses"><span></span><span hidden></span></div>
      </aside>
      <div class="pose-wall-feedback">
        <p role="status" aria-atomic="true"></p>
        <strong class="pose-wall-count" aria-hidden="true" hidden></strong>
      </div>
    </div>
    <section class="pose-wall-over" aria-labelledby="pose-wall-over-title" hidden>
      <h2 id="pose-wall-over-title">게임 오버</h2>
      <p>벽에 네 번 부딪혔어요.</p>
      <p class="pose-wall-final-score"></p>
      <button class="pose-wall-restart" type="button">다시 시작</button>
    </section>
  </main>
`
