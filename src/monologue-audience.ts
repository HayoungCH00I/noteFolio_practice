import type { Point } from './gestures.ts'

export const SEARCH_GRACE_MS = 6000

export function quietRadius(width: number, height: number): number {
  return Math.max(24, Math.min(44, Math.min(width, height) * 0.055))
}
export function isQuietPoint(pointer: Point | null, quiet: Point, width: number, height: number): boolean {
  return pointer !== null && Math.hypot((pointer.x - quiet.x) * width, (pointer.y - quiet.y) * height) <= quietRadius(width, height)
}

/** Time spent searching is counted only while this page is visible and talking. */
export class SearchPressure {
  private last: number | null = null
  private elapsed = 0
  private level = 0
  reset(now: number) { this.last = now; this.elapsed = 0; this.level = 0 }
  pause() { this.last = null }
  update(now: number, found: boolean): number | null {
    if (this.last !== null) this.elapsed += Math.max(0, now - this.last)
    this.last = now
    if (found) { this.elapsed = 0; this.level = 0; return null }
    const level = Math.floor(this.elapsed / SEARCH_GRACE_MS)
    if (level > this.level) { this.level = level; return level }
    return null
  }
}

const questions = [
  '근데, 너라도 이런 피드백 받으면 당황하지 않아? 지금 고개 끄덕인 거 공감한다는 뜻이지?',
  '아니, 너 지금 듣고 있지? 나 혼자 모니터한테 얘기하는 거 아니지?',
  '진짜? 너라면 그 상황에서 뭐라고 했을 건데? 일단 내 얘기부터 조금만 더 들어봐.',
  '정말? 그 표정은 너무 잘 알겠다는 뜻으로 받아들일게.',
  '하… 너도 이런 날 집에 오면 현관에서 한참 서 있지 않아?',
  '근데, 너라면 어떻게 했어? 대답 생각하는 동안 내가 뒷얘기 좀 할게.',
  '아니, 너 방금 웃었지? 웃긴데 내 일이 되면 하나도 안 웃기다니까.',
  '하지만, 너도 내 편은 들어줘야 하는 거 아니야? 지금 얘기 들어주는 사람 너밖에 없어.',
  '진짜, 너한테만 하는 얘긴데 이건 좀 억울하지 않아?',
  '하… 너도 퇴근하고 할 말 많을 것 같은데. 일단 내 차례 조금만 더 할게.',
]
const nags = [
  [
    '아니, 너 지금 찾는 거 맞아? 커서로 출근 도장만 찍고 있는 거 아니지?',
    '하… 육 초나 지났는데 아직도? 클라이언트 컨펌 기다리는 줄 알았네.',
    '진짜? 커서는 이렇게 바쁜데 찾은 건 하나도 없네. 오늘 우리 시안 회의 같아.',
    '근데, 거기 말고. 아니, 또 거기? 혹시 내 얘기 더 듣고 싶어서 일부러 그러는 거야?',
  ],
  [
    '정말? 이렇게 넓게 돌아다니는데 조용해지는 데만 쏙 빼고 가네. 그것도 재능이다.',
    '아니, 찾는 척만 하는 거야? 나도 시안 고르는 척은 해봤는데 너는 좀 티가 나잖아.',
    '하… 커서 이동 거리는 성과가 아니거든? 왔다 갔다 말고 진도를 좀 내봐.',
    '하지만, 이쯤 되면 내가 말이 많은 게 아니라 네가 나한테 계속 발언권을 주는 거거든?',
  ],
  [
    '아니, 이거 찾는 데도 회의를 잡아야 돼? 네 커서부터 디자인 리뷰에 올려야겠네.',
    '진짜? 방금 지나간 데를 또 돌아? 인수인계는 받았는데 기억은 두고 온 거야?',
    '하… 지금쯤이면 내 브랜드 가이드도 납품했겠다. 커서야, 너도 일을 좀 해.',
    '정말? 그 속도면 찾기 전에 내 시안 수정기 시즌 투가 나오겠는데?',
    '아니, 화면은 하나인데 탐색은 왜 세계 일주를 하고 있어? 출장비라도 청구하려고?',
    '근데, 이 정도면 내 입을 막을 생각이 없는 거지? 좋아, 그럼 나 하나만 더 얘기한다?',
  ],
]
const foundRemarks = [
  '… 아니, 방금 딱 거기였는데 왜 또 나와? 나 다시 말한다?',
  '… 하, 이제야 좀 조용하나 했더니. 네가 다시 움직였으니까 내 얘기 계속한다?',
  '… 어, 찾았잖아. 근데 왜 나왔어? 내 얘기 아직 궁금한 거 맞네.',
]

export class AudienceRemarks {
  private previous = ''
  private pick(lines: string[]): string {
    const choices = lines.filter(line => line !== this.previous)
    const line = choices[Math.floor(Math.random() * choices.length)]!
    this.previous = line
    return line
  }
  conversation(): string { return this.pick(questions) }
  complaint(level: number): string { return this.pick(nags[Math.min(2, Math.max(0, level - 1))]!) }
  found(): string { return this.pick(foundRemarks) }
}
