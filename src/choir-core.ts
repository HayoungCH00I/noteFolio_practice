export const choirVideo = { id: '64fwAdHw18I', start: 18, end: 112, title: '상어 가족 합창편 · 핑크퐁' } as const
export type Palm = { x: number; y: number }
export const conductingMotions = {
  vertical: { label: '천천히 · 위아래', pose: 'open', rate: .75 },
  sweep: { label: '빠르게 · 좌우', pose: 'two', rate: 1.25 },
  circle: { label: '둥글게 · 원 그리기', pose: 'three', rate: 1 },
} as const
export type ConductingMotion = keyof typeof conductingMotions
export function choirRating(harmony: number) {
  if (harmony < .25) return { key: 'bad', label: 'BAD', message: '박자가 많이 어긋나요. 안내 손을 따라 해주세요.' }
  if (harmony < .5) return { key: 'soso', label: 'SO SO', message: '조금만 더! 손 모양과 타이밍을 맞춰주세요.' }
  if (harmony < .8) return { key: 'nice', label: 'NICE', message: '좋아요! 같은 리듬을 유지해 주세요.' }
  return { key: 'excellent', label: 'EXCELLENT!', message: '완벽한 호흡이에요! 계속 이어가요!' }
}
export class ConductingSequence {
  motion: ConductingMotion = 'vertical'
  private elapsed = 0
  private random: () => number
  constructor(random = Math.random) { this.random = random; this.reset() }
  reset() { this.elapsed = 0; this.motion = (Object.keys(conductingMotions) as ConductingMotion[])[Math.min(2, Math.floor(this.random() * 3))]! }
  advance(dt: number, singing: boolean) {
    if (!singing) return false
    this.elapsed += dt
    if (this.elapsed < 10) return false
    this.elapsed = 0
    const options = (Object.keys(conductingMotions) as ConductingMotion[]).filter(motion => motion !== this.motion)
    this.motion = options[Math.min(1, Math.floor(this.random() * 2))]!
    return true
  }
}
export class Conducting {
  phase = 0
  harmony = .75
  beats = 0
  matched = 0
  hasHands = false
  still = false
  targetBpm = 60
  lastMotion = 0
  private lastSeen = -Infinity
  private previous?: { y: number; left: number; right: number; time: number }
  private direction = 0
  private high = 1
  private low = 0
  private lastBeat = -Infinity
  private judgedCycle = 0
  private grades: number[] = [1, 1, 1]
  private graceUntil = 0
  private motionAnchor?: [Palm, Palm]
  recalibrate(now: number) {
    this.previous = undefined; this.direction = 0; this.high = 1; this.low = 0; this.graceUntil = now + 1400; this.lastBeat = now
  }
  reset(now: number) {
    this.phase = 0; this.harmony = .75; this.beats = this.matched = 0; this.hasHands = this.still = false; this.lastMotion = now
    this.lastSeen = -Infinity; this.previous = undefined; this.direction = 0; this.high = 1; this.low = 0; this.lastBeat = -Infinity; this.judgedCycle = 0; this.motionAnchor = undefined; this.grades = [1, 1, 1]; this.graceUntil = now + 1800
  }
  advance(dt: number, now: number, playing: boolean) {
    this.phase += Math.min(.08, dt) * this.targetBpm / 60
    if (now - this.lastSeen > 450) { this.hasHands = false; this.previous = undefined }
    this.still = this.hasHands && now - this.lastMotion > 2000
    if (!playing || !this.hasHands || now < this.graceUntil) { this.judgedCycle = Math.floor(this.phase); return }
    const cycle = Math.floor(this.phase)
    if (cycle > this.judgedCycle) {
      if (now - this.lastBeat > 60000 / this.targetBpm * 1.6) this.grade(false)
      this.judgedCycle = cycle
    }
  }
  hands(palms: Palm[], now: number, playing: boolean, validPose = true) {
    if (palms.length !== 2) return
    const [left, right] = [...palms].sort((a, b) => a.x - b.x)
    if (!left || !right) return
    if (!this.hasHands) { this.lastMotion = now; this.motionAnchor = [{ ...left }, { ...right }]; this.graceUntil = now + 1400 }
    this.hasHands = true; this.lastSeen = now
    const y = (left.y + right.y) / 2, previous = this.previous
    this.previous = { y, left: left.y, right: right.y, time: now }
    if (!previous || now - previous.time > 250) { this.high = this.low = y; this.direction = 0; return }
    const dy = y - previous.y, velocity = dy / Math.max(.016, (now - previous.time) / 1000)
    if (!this.motionAnchor || Math.hypot(left.x - this.motionAnchor[0].x, left.y - this.motionAnchor[0].y) > .018 || Math.hypot(right.x - this.motionAnchor[1].x, right.y - this.motionAnchor[1].y) > .018) { this.lastMotion = now; this.motionAnchor = [{ ...left }, { ...right }] }
    this.high = Math.min(this.high, y); this.low = Math.max(this.low, y)
    if (velocity > .035) this.direction = 1
    else if (velocity < -.035 && this.direction === 1 && this.low - this.high > .035 && now - this.lastBeat > 220) {
      this.direction = -1
      const fraction = this.phase % 1, error = Math.abs(fraction - .5)
      const sameDirection = (left.y - previous.left) * (right.y - previous.right) >= 0
      const aligned = Math.abs(left.y - right.y) < .24 && sameDirection
      if (playing && now > this.graceUntil) this.grade(error < .24 && aligned && validPose)
      this.lastBeat = now; this.high = this.low = y
    }
  }
  private grade(good: boolean) {
    this.beats++; if (good) this.matched++
    this.grades.push(good ? 1 : 0); if (this.grades.length > 6) this.grades.shift()
    this.harmony = this.grades.reduce((sum, value) => sum + value, 0) / this.grades.length
  }
}
