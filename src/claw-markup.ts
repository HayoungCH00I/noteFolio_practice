import { dollNames } from './claw-doll-data.ts'

const featureSelect = (name: string, label: string) => `<fieldset class="claw-feature claw-wide"><legend>${label}</legend><div class="claw-feature-options">${dollNames.map((v, i) => `<label class="claw-feature-option" title="${v}의 ${label}"><input type="radio" name="${name}" value="${i}" ${i === 0 ? 'checked' : ''}><img data-feature="${name}" data-index="${i}" alt="${v}의 ${label}" width="80" height="64"></label>`).join('')}</div></fieldset>`
export const clawMarkup = `<main id="page-seventh" class="claw-page app-page" hidden>
  <header class="claw-heading"><span>WEEK 02 · THE PLUSH CLUB</span><h1>조금만 더,<br>내 쪽으로.</h1><p>갖고 싶은 작은 친구를 향해.<br>오늘의 행운은 당신 손끝에 있어요.</p></header>
  <div class="claw-viewport" tabindex="0" role="application" aria-label="3D 인형뽑기. 방향키로 이동하고 스페이스로 뽑으세요."></div>
  <div class="claw-machine-title">THE PLUSH CLUB <span>한 번의 작은 설렘</span></div>
  <div class="claw-view-buttons"><button data-view="angle">입체 보기</button><button data-view="front">정면 보기</button><button data-view="top">위에서 보기</button><button data-view="collection">내 인형 진열대</button><button data-zoom="out" aria-label="축소">−</button><button data-zoom="in" aria-label="확대">＋</button><span>드래그로 360° 회전</span></div>
  <aside class="claw-custom"><div class="claw-panel-title"><span>YOUR LITTLE FRIEND</span><h2>내 인형 만들기</h2></div><div class="claw-preview" aria-label="꾸민 인형의 3D 미리보기"></div>
    <form class="claw-form">${featureSelect('base', '캐릭터')}
    ${featureSelect('eyes', '눈')}${featureSelect('brows', '눈썹')}${featureSelect('nose', '코')}${featureSelect('mouth', '입·입술')}${featureSelect('ears', '귀')}
    <label>몸 색상<input name="color" type="color" value="#fff0bb"></label><label class="claw-wide">봉제 패턴<select name="pattern"><option value="plain">무지</option><option value="dots">도트</option><option value="stripes">스트라이프</option></select></label>
    <div class="claw-checks claw-wide"><label><input name="mole" type="checkbox"> 점</label><label><input name="glasses" type="checkbox"> 안경</label><label><input name="piercing" type="checkbox"> 피어싱</label></div>
    <label class="claw-upload claw-wide">사진 패치 추가<input name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label><button type="button" class="claw-remove-photo claw-wide" hidden>사진 패치 지우기</button><p class="claw-wide claw-photo-note">사진은 인형 얼굴 앞면에 붙어요. 얼굴 부품은 위 다섯 친구의 디자인에서 선택해요.</p>
    <button type="submit" class="claw-add claw-wide">이 인형을 기계에 넣기 <span>＋</span></button></form>
  </aside>
  <footer class="claw-controls"><div class="claw-status" role="status" aria-live="polite">방향키로 원하는 인형 위에 집게를 맞춰 주세요.</div><div class="claw-control-row"><div class="claw-dpad"><button data-dir="up" aria-label="뒤로">↑</button><button data-dir="left" aria-label="왼쪽">←</button><button data-dir="down" aria-label="앞으로">↓</button><button data-dir="right" aria-label="오른쪽">→</button></div><button class="claw-drop">뽑기 <kbd>SPACE</kbd></button><span class="claw-wins">획득 <strong>0</strong></span><button class="claw-refill">인형 채우기 ↻</button></div></footer>
</main>`
