type Pair = readonly [number, number]
export type Figure = readonly [Pair, Pair, Pair, Pair, Pair, Pair, Pair, Pair, Pair, Pair, Pair, Pair, Pair]
export type PosePreset = { name: string; cue: string; figures: readonly Figure[] }
export type PlayerCount = 1 | 2

// Head, screen-left arm, screen-right arm, screen-left leg, screen-right leg.
// Each limb lists its three joints from the torso outward.
const flex: Figure = [
  [54, 12], [39, 25], [24, 28], [32, 8], [66, 25], [81, 28], [75, 9],
  [46, 55], [43, 76], [41, 96], [61, 55], [64, 76], [66, 96],
]
const crouch: Figure = [
  [45, 17], [34, 31], [19, 28], [16, 9], [58, 32], [69, 46], [85, 54],
  [43, 58], [33, 77], [32, 96], [60, 58], [71, 76], [75, 96],
]
const point: Figure = [
  [45, 16], [34, 30], [19, 31], [4, 26], [58, 32], [68, 45], [61, 57],
  [41, 57], [36, 76], [34, 96], [58, 56], [64, 76], [67, 96],
]
const balance: Figure = [
  [46, 12], [32, 28], [17, 29], [2, 30], [61, 28], [77, 29], [93, 30],
  [41, 55], [38, 76], [36, 96], [57, 55], [60, 76], [62, 96],
]
const crossedArms: Figure = [
  [40, 13], [39, 28], [40, 49], [61, 41], [63, 25], [73, 41], [48, 45],
  [45, 57], [44, 77], [43, 96], [60, 57], [66, 77], [70, 96],
]
const present: Figure = [
  [42, 30], [28, 44], [43, 55], [72, 63], [54, 42], [68, 40], [91, 34],
  [36, 61], [31, 79], [27, 96], [53, 61], [58, 79], [61, 96],
]
const handsBehind: Figure = [
  [52, 13], [39, 30], [26, 19], [45, 17], [64, 30], [79, 19], [60, 17],
  [44, 57], [41, 77], [39, 96], [58, 57], [61, 77], [63, 96],
]
const highFive: Figure = [
  [52, 13], [37, 28], [32, 44], [33, 61], [64, 28], [76, 31], [82, 14],
  [42, 56], [39, 76], [37, 96], [58, 56], [60, 76], [62, 96],
]
const heart: Figure = [
  [59, 24], [42, 35], [34, 15], [71, 5], [68, 40], [70, 60], [87, 69],
  [44, 59], [41, 78], [39, 96], [60, 59], [63, 78], [66, 96],
]
const running: Figure = [
  [44, 17], [30, 34], [17, 46], [9, 31], [56, 34], [72, 42], [65, 58],
  [43, 59], [39, 77], [36, 96], [58, 60], [62, 77], [65, 96],
]
const runningMate: Figure = [
  [43, 17], [30, 34], [20, 44], [15, 32], [57, 34], [75, 39], [70, 57],
  [43, 58], [40, 76], [38, 96], [57, 58], [60, 76], [62, 96],
]

function offset(figure: Figure, x: number, mirror = false) {
  const [head, a, b, c, d, e, f, g, h, i, j, k, l] = figure.map(([px, py]) => [x + (mirror ? 100 - px : px), py] as const)
  return mirror ? [head, d, e, f, a, b, c, j, k, l, g, h, i] as const : [head, a, b, c, d, e, f, g, h, i, j, k, l] as const
}

const presets: Record<PlayerCount, readonly PosePreset[]> = {
  1: [
    { name: '양팔 번쩍', cue: '두 팔꿈치를 벌리고 주먹을 올리세요', figures: [flex] },
    { name: '한 손 들고 살짝 굽히기', cue: '한 손을 들고 무릎을 살짝 굽히세요', figures: [crouch] },
    { name: '옆으로 가리키기', cue: '한 팔을 옆으로 뻗으세요', figures: [point] },
    { name: '양팔 펼치기', cue: '양팔을 어깨 높이로 펼치세요', figures: [balance] },
    { name: '팔짱 끼고 기울기', cue: '팔짱을 끼고 몸을 살짝 기울이세요', figures: [crossedArms] },
  ],
  2: [
    { name: '한 명은 소개, 한 명은 여유', cue: '왼쪽은 팔을 뻗고 오른쪽은 두 손을 머리 옆에', figures: [present, offset(handsBehind, 108)] },
    { name: '하이파이브', cue: '두 사람 모두 안쪽 손을 드세요', figures: [highFive, offset(highFive, 86, true)] },
    { name: '둘이 만드는 하트', cue: '바깥쪽 팔을 머리 위로 둥글게 올리세요', figures: [heart, offset(heart, 66, true)] },
    { name: '달리기 팔 자세', cue: '한 주먹은 어깨 옆, 다른 팔꿈치는 아래로', figures: [running, offset(runningMate, 82)] },
  ],
}

export function choosePose(players: PlayerCount, previous?: PosePreset) {
  const candidates = presets[players].filter(pose => pose !== previous)
  return candidates[Math.floor(Math.random() * candidates.length)]
}
