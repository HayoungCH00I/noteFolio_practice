export const dollNames = ['우사기', '하치와레', '치이카와', '모몽가', '랏코']
export type DollOptions = { base: number; color: string; eyes: number; brows: number; nose: number; mouth: number; ears: number; pattern: string; mole: boolean; glasses: boolean; piercing: boolean; photo?: HTMLImageElement }
export const preset = (base: number): DollOptions => ({ base, color: ['#fff0bb', '#fcfbf2', '#fffaf4', '#f7f6ef', '#f7e4bb'][base]!, eyes: base, brows: base, nose: base, mouth: base, ears: base, pattern: 'plain', mole: false, glasses: false, piercing: false })
