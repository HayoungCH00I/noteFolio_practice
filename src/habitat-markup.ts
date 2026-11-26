export const habitatMarkup = `
<main id="page-sixteenth" class="app-page habitat" hidden>
  <canvas class="habitat-world" tabindex="0" aria-label="3D 지구와 동네 산책 화면"></canvas>
  <header><h1>우리 동네 걷기</h1><p data-location>드래그로 지구를 돌리고, 휠이나 두 손가락으로 확대해 보세요.</p></header>
  <footer><button type="button" data-join>우리 동네 걷기 <span aria-hidden="true">↗</span></button></footer>
  <div class="habitat-actions" data-actions hidden><button data-talk>대화하기</button><button data-manual>직접 걷기</button></div>
  <div class="habitat-toolbar" data-toolbar hidden>
    <button data-select>주민 선택</button><button data-view hidden>앞모습 보기</button>
    <button data-auto hidden>자동 산책</button><button data-home>지구로</button>
  </div>
  <div class="habitat-pad" data-pad hidden aria-label="캐릭터 이동">
    <button data-key="ArrowUp" aria-label="앞으로 걷기">▲</button><button data-key="ArrowLeft" aria-label="왼쪽으로 돌기">◀</button>
    <button data-key="ArrowDown" aria-label="뒤로 걷기">▼</button><button data-key="ArrowRight" aria-label="오른쪽으로 돌기">▶</button>
  </div>
  <section class="habitat-chat" data-chat hidden aria-label="주민 대화">
    <strong>산책 주민</strong><p aria-live="polite" data-line></p>
    <div><button data-near>근처에 뭐가 있어?</button><button data-goodbye>다시 산책하자</button></div>
  </section>
  <small class="habitat-credit" hidden><a href="https://openfreemap.org/" target="_blank" rel="noreferrer">OpenFreeMap</a> · <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">© OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></small>
  <dialog aria-labelledby="habitat-title">
    <button type="button" class="habitat-close" aria-label="닫기">×</button>
    <h2 id="habitat-title">캐릭터 만들기</h2>
    <section data-skin-step>
      <div class="habitat-portrait"><canvas data-preview aria-label="내 캐릭터 3D 미리보기"></canvas><video muted playsinline autoplay hidden></video></div>
      <label>스킨 이미지 <input type="file" accept="image/*" data-art></label>
      <div class="habitat-buttons"><button type="button" data-camera>카메라 켜기</button><button type="button" data-shoot hidden>사진 찍기</button></div>
      <button type="button" class="habitat-primary" data-next>이 캐릭터로 동네 찾기</button>
    </section>
    <section data-address-step hidden>
      <form data-search><label>산책할 주소 또는 장소<input data-address required maxlength="180" placeholder="예: 서울특별시 중구 세종대로 110"></label>
      <button class="habitat-primary">주소 검색</button></form>
      <div data-results class="habitat-results"></div>
      <button type="button" data-back>캐릭터로 돌아가기</button>
    </section>
    <p role="status" data-message></p>
  </dialog>
</main>`
