import { companyStations } from './company-data.ts'

export const companyMarkup = `<main class="company-page app-page" id="page-eighth" hidden>
  <header class="company-heading"><span>WEEK 02 / OFFICE PLAYGROUND</span><h1>회사<span>출근은 했고, 갓생은 선택.</span></h1></header>
  <div class="company-viewport" tabindex="0" role="application" aria-label="회사 놀이터. 방향키로 이동, 휠로 확대, 드래그로 화면 이동."><div class="company-station-layer">${Object.entries(companyStations).map(([key, station]) => `<section class="company-station-card" data-station="${key}"><strong>${station.title}</strong>${key === 'boss' ? '<p class="company-boss-feedback" role="status" hidden></p><div class="company-rhythm" hidden><span>초록 구간에 SPACE!</span><div><i></i><b></b></div></div>' : ''}<div class="company-buttons"><button data-use="${key}" disabled>갓생살기</button><button data-action="${key}" hidden>액션 SPACE</button><button data-leave="${key}" hidden>나오기</button></div></section>`).join('')}</div></div>
  <div class="company-presence">함께 출근한 사람 <strong>0</strong>명</div>
  <div class="company-guide">① 부장님과 면담　② 무한 복합기　③ 화캉스　④ 업무의 날씨</div>
  <section class="company-entry"><form><span>WELCOME TO THE OFFICE</span><h2>오늘은 어떤 동료인가요?</h2><p>닉네임을 적으면 랜덤한 옷을 입고 출근해요.<br>같은 주소로 들어온 동료들과 함께 놀아보세요.</p><label>닉네임<input name="nickname" maxlength="12" required autocomplete="off" placeholder="예: 퇴근요정"></label><button type="submit">출근하기 ↗</button><p class="company-entry-status" role="status"></p></form></section>
  <div class="company-joystick" role="application" aria-label="터치 이동 조이스틱"><span></span></div>
  <footer class="company-ui"><p class="company-status" role="status">닉네임을 입력하고 출근해 주세요.</p><button class="company-follow" type="button">내 캐릭터 보기 ◎</button><button class="company-mute" aria-pressed="false">소리 켜짐 ♪</button><p class="company-help">방향키·조이스틱으로 이동 · 휠·두 손가락으로 확대 · 이동 시 캐릭터 자동 추적 · 드래그로 둘러보기</p></footer>
</main>`
