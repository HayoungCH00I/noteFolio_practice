import type { ConductingMotion } from './choir-core.ts'

type InstructionState = {
  cameraNotice: string; musicNotice: string; cameraOn: boolean; musicReady: boolean
  started: boolean; ended: boolean; remaining: number; paused: boolean; hasHand: boolean; singing: boolean
  scolded: number; selected: number; beats: number; matched: number; motion: ConductingMotion
  scoldTarget?: number
}
export function choirInstruction(state: InstructionState) {
  const notice = state.cameraNotice || state.musicNotice
  if (notice) return { kind: 'notice', text: notice }
  if (!state.cameraOn) return { kind: 'setup', text: '카메라를 켜고 합창 시작을 눌러 주세요.' }
  if (!state.musicReady) return { kind: 'setup', text: '합창곡을 준비하고 있어요…' }
  if (!state.started) return { kind: 'ready', text: '준비됐어요! 합창 시작을 눌러 주세요.' }
  if (state.ended) return { kind: 'ended', text: `합창을 마쳤어요! ${state.beats}번 중 ${state.matched}번 박자를 맞췄어요.` }
  if (state.remaining > 0) return { kind: 'countdown', text: '잠시 후 합창을 다시 시작합니다.' }
  if (state.paused || !state.hasHand) return { kind: 'paused', text: '노래를 잠시 멈췄어요.' }
  if (!state.singing) return { kind: 'waiting', text: '합창을 시작하고 있어요…' }
  if (state.scoldTarget !== undefined && state.scoldTarget >= 0) return {
    kind: 'scold-prompt',
    text: state.selected === state.scoldTarget ? `${state.scoldTarget + 1}번 단원을 향해 검지를 좌우로 흔들어 혼내세요!` : `${state.scoldTarget + 1}번 단원을 검지로 가리킨 뒤 좌우로 흔들어 혼내세요!`,
  }
  if (state.scolded >= 0) return { kind: 'scolded', text: `${state.scolded + 1}번 단원이 시무룩해졌어요…` }
  if (state.selected >= 0) return { kind: 'selected', text: `${state.selected + 1}번 선택 · 검지를 좌우로 흔들어 보세요.` }
  const motions = { vertical: '다섯 손가락을 펴고 천천히 위아래로', sweep: '검지·중지만 펴고 빠르게 좌우로', circle: '검지·중지·약지만 펴고 작은 원을 그려요' }
  return { kind: 'conducting', text: motions[state.motion] }
}
