import type { ConductingMotion } from './choir-core.ts'
export function choirGuide(motion: ConductingMotion | 'point' | 'pinch' | 'fist') {
  const count = motion === 'vertical' ? 4 : motion === 'sweep' ? 2 : motion === 'point' || motion === 'pinch' ? 1 : motion === 'fist' ? 0 : 3
  const fingers = [0, 1, 2, 3].map((i) => {
    const height = [62, 76, 66, 48][i]!, x = 26 + i * 18
    return i < count ? `<rect x="${x}" y="${90 - height}" width="17" height="${height + 20}" rx="8.5" fill="white"/>` : `<rect x="${x}" y="78" width="17" height="29" rx="8.5" fill="white" stroke="#89939b" stroke-width="1.5"/>`
  }).join('')
  const thumb = motion === 'vertical' ? '<rect x="9" y="89" width="21" height="45" rx="10" fill="white" transform="rotate(-30 19 111)"/>' : motion === 'pinch' ? '<rect x="1" y="91" width="52" height="21" rx="10" fill="white"/><path d="M7 72L21 47M7 72L7 60M7 72L18 67M21 47L10 52M21 47L21 59" fill="none" stroke="white" stroke-width="3" stroke-linecap="round"/>' : '<rect x="28" y="99" width="36" height="17" rx="8.5" fill="white" stroke="#89939b" stroke-width="1.5"/>'
  return `<svg viewBox="0 0 125 155" aria-hidden="true"><rect x="25" y="86" width="74" height="56" rx="25" fill="white"/>${fingers}${thumb}<path d="M45 125Q62 117 80 124" fill="none" stroke="#adb7ba" stroke-width="2"/></svg>`
}
export const choirMarkup = `<main id="page-eleventh" class="choir-page app-page" hidden>
  <div class="choir-viewport" aria-label="카메라 화면 앞 나무 무대에 한 줄로 서 있는 네 명의 합창단">
    <video class="choir-camera" autoplay muted playsinline aria-label="합창단 뒤에 보이는 내 카메라 화면"></video>
    <div class="choir-pointer" hidden>☝</div>
    <div class="choir-guide">
      <div class="choir-guide-visual"><div class="choir-guide-hands" hidden><div>${choirGuide('vertical')}</div></div><div class="choir-countdown" hidden><strong>3</strong></div><div class="choir-desk" aria-hidden="true" hidden><i></i></div><div class="choir-music-actions"><button type="button" class="choir-tracking-retry" hidden>손 추적 다시 시도</button><button type="button" class="choir-reload" hidden>음원 다시 불러오기</button><button type="button" class="choir-allow" hidden>노래 재생 허용 ▶</button></div></div>
      <p class="choir-cue" role="status" aria-live="polite">카메라를 켜고 합창 시작을 눌러 주세요.</p>
    </div>
  </div>
  <div class="choir-pitch" role="meter" aria-label="왼손으로 조절하는 음높이" aria-valuemin="-6" aria-valuemax="6" aria-valuenow="0"><b></b><i></i></div>
  <div class="choir-quality" hidden><strong>NICE</strong><p>지휘 호흡</p></div>
  <div class="choir-help" aria-label="손동작 안내">
    <div class="choir-help-left"><div class="choir-help-icon">${choirGuide('pinch')}</div><strong>왼손</strong><span>음높이</span></div>
    <div class="choir-help-right"><div class="choir-help-icon">${choirGuide('vertical')}</div><strong>오른손</strong><span class="choir-help-action">지휘</span></div>
    <div><div class="choir-help-icon choir-help-fists">${choirGuide('fist')}${choirGuide('fist')}</div><strong>양손 주먹</strong><span>멈춤</span></div>
  </div>
  <button type="button" class="choir-camera-toggle">카메라 켜기</button>
  <div class="choir-start-controls"><button type="button" class="choir-pause" disabled>잠깐 쉬기</button><button type="button" class="choir-start" disabled>합창 시작</button><p class="choir-progress">0:18 / 1:52</p></div>
</main>`
