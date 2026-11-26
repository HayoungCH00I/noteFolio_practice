import { makeOpening, type BodyMask, type Point, type WallOpening } from './pose-wall-opening.ts'
import { choosePose, type PlayerCount, type PosePreset } from './pose-wall-presets.ts'

export const poseWallTitle = '자세 통과'
export const allowedMisses = 3
export const countdownMs = 3000
export const approachMs = 4000
export const passThroughMs = 690

type Landmark = Point & { visibility: number }
export type BodyPose = { mask?: BodyMask; joints: (Point | undefined)[]; x: number }
export type PoseVerdict = 'ready' | 'adjust' | 'waiting'
const leftSide = [11, 13, 15, 23, 25, 27], rightSide = [12, 14, 16, 24, 26, 28]

export function trackedBody(landmarks: Landmark[], mask?: BodyMask): BodyPose | undefined {
  const visible = (index: number) => {
    const p = landmarks[index]
    return p?.visibility >= .25 && p.x > .008 && p.x < .992 && p.y > .008 && p.y < .992 ? p : undefined
  }
  const left = visible(11), right = visible(12)
  if (!left || !right) return
  const [screenLeft, screenRight] = left.x <= right.x ? [leftSide, rightSide] : [rightSide, leftSide]
  const joints = [visible(0), ...screenLeft.slice(0, 3).map(visible), ...screenRight.slice(0, 3).map(visible),
    ...screenLeft.slice(3).map(visible), ...screenRight.slice(3).map(visible)]
  return { mask, joints, x: (left.x + right.x) / 2 }
}

function lanes(opening: WallOpening, bodies: BodyPose[]) {
  const centers = opening.figures.map(figure => (figure[1].x + figure[4].x) / 2)
  if (centers.length === 1) return [bodies[0]]
  const divider = (centers[0] + centers[1]) / 2
  return [bodies.find(body => body.x <= divider), bodies.find(body => body.x > divider)]
}

export function framedPlayers(opening: WallOpening, bodies: BodyPose[]) {
  return lanes(opening, bodies).map(body => {
    if (!body) return false
    const { joints, mask, x } = body
    const head = joints[0], feet = [joints[9], joints[12]]
    if (!head || head.y < .025 || x < .075 || x > .925) return false
    if (feet.every(foot => foot && foot.y > head.y + .19 && foot.y < .98)) return true
    // A visible silhouette gives a usable framing check when one ankle is hidden.
    if (!mask) return false
    let bottom = -1
    for (let y = mask.height - 1; y >= 0 && bottom < 0; y--) {
      for (let col = 0; col < mask.width; col++) if (mask.data[y * mask.width + col]) { bottom = y / mask.height; break }
    }
    return bottom > head.y + .24 && bottom < .975
  })
}

export function openingFeedback(opening: WallOpening, bodies: BodyPose[]): PoseVerdict[] {
  const { frameWidth, frameHeight } = opening
  return lanes(opening, bodies).map((body, index) => {
    if (!body) return 'waiting'
    const target = opening.figures[index], joints = body.joints
    const directionError = (from: number, to: number) => {
      const a = joints[from], b = joints[to]
      if (!a || !b) return undefined
      const x = (b.x - a.x) * frameWidth, y = (b.y - a.y) * frameHeight
      const tx = (target[to].x - target[from].x) * frameWidth, ty = (target[to].y - target[from].y) * frameHeight
      const length = Math.hypot(x, y), targetLength = Math.hypot(tx, ty)
      if (length < 1.5 || targetLength < 1) return undefined
      return 1 - Math.max(-1, Math.min(1, (x * tx + y * ty) / (length * targetLength)))
    }
    const armError = (shoulder: number) => {
      const upper = directionError(shoulder, shoulder + 1), lower = directionError(shoulder + 1, shoulder + 2)
      if (upper !== undefined && lower !== undefined) return upper * .52 + lower * .48
      return directionError(shoulder, shoulder + 2) ?? upper ?? lower
    }
    const left = armError(1), right = armError(4)
    if (left === undefined || right === undefined) return 'waiting'
    const torso = [directionError(1, 7), directionError(4, 10)].filter(value => value !== undefined)
    const torsoError = torso.length ? torso.reduce((sum, value) => sum + value, 0) / torso.length : 0
    const expectedX = (target[1].x + target[4].x) / 2
    const laneTolerance = opening.figures.length === 1 ? .24 : .20
    return Math.abs(body.x - expectedX) <= laneTolerance && left <= .52 && right <= .52
      && (left + right) / 2 + torsoError * .15 <= .39 ? 'ready' : 'adjust'
  })
}

export class PoseWallRound {
  phase: 'waiting' | 'countdown' | 'wall' | 'passing' | 'over' = 'waiting'
  opening?: WallOpening
  preset?: PosePreset
  countdown = 3
  progress = 0
  score = 0
  misses = 0
  practice = true
  outcome?: 'pass' | 'hit' | 'retry'
  feedback: PoseVerdict[] = []
  private history: { time: number; verdicts: PoseVerdict[] }[] = []
  private lastSample = -Infinity
  private elapsed = 0
  private previous?: number
  private lastPreset?: PosePreset
  readonly players: PlayerCount

  constructor(players: PlayerCount) { this.players = players }

  advance(now: number, bodies: BodyPose[], imageWidth: number, imageHeight: number, sampled = now) {
    const dt = Math.min(150, Math.max(0, now - (this.previous ?? now)))
    this.previous = now
    switch (this.phase) {
      case 'waiting':
        if (!this.opening && imageWidth > 0 && imageHeight > 0) {
          this.preset = this.lastPreset = choosePose(this.players, this.lastPreset)
          this.opening = makeOpening(this.preset, imageWidth, imageHeight)
        }
        if (this.opening && framedPlayers(this.opening, bodies).every(Boolean)) {
          this.elapsed += dt
          if (this.elapsed < 350) break
          this.elapsed = 0
          this.countdown = 3
          this.history = []
          this.feedback = []
          this.lastSample = -Infinity
          this.phase = 'countdown'
        } else this.elapsed = 0
        break
      case 'countdown':
        this.elapsed += dt
        this.countdown = Math.max(1, Math.ceil((countdownMs - this.elapsed) / 1000))
        if (this.elapsed >= 900) this.observe(now, sampled, bodies)
        if (this.elapsed >= countdownMs) {
          this.elapsed = this.progress = 0
          this.phase = 'wall'
        }
        break
      case 'wall':
        this.elapsed += dt
        this.progress = Math.min(1, this.elapsed / approachMs)
        this.observe(now, sampled, bodies)
        if (this.progress === 1) {
          this.outcome = this.feedback.includes('waiting') ? 'retry' : this.feedback.every(verdict => verdict === 'ready') ? 'pass' : 'hit'
          if (!this.practice && this.outcome === 'pass') this.score++
          if (!this.practice && this.outcome === 'hit') this.misses++
          this.elapsed = this.progress = 0
          this.phase = 'passing'
        }
        break
      case 'passing':
        this.elapsed += dt
        this.progress = Math.min(1, this.elapsed / passThroughMs)
        if (this.progress === 1) {
          if (this.outcome !== 'retry') {
            this.opening = undefined
            this.practice = false
          }
          this.feedback = []
          this.elapsed = 0
          this.phase = this.misses > allowedMisses ? 'over' : 'waiting'
        }
        break
    }
  }

  private observe(now: number, sampled: number, bodies: BodyPose[]) {
    if (sampled > this.lastSample && sampled >= now - 350) {
      this.history.push({ time: sampled, verdicts: openingFeedback(this.opening!, bodies) })
      this.lastSample = sampled
    }
    this.history = this.history.filter(sample => now - sample.time <= 520)
    this.feedback = this.opening!.figures.map((_, i) => {
      const recognized = this.history.map(sample => sample.verdicts[i]).filter(verdict => verdict !== 'waiting')
      if (recognized.length < 2) return 'waiting'
      return recognized.filter(verdict => verdict === 'ready').length * 2 >= recognized.length ? 'ready' : 'adjust'
    })
  }
}
