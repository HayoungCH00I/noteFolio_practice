export type PersonMask = { width: number; height: number; data: Uint8Array }
export const swingDuration = 300
export function swingMotion(progress: number) {
  const p = Math.max(0, Math.min(1, progress)), sweep = Math.sin(Math.sqrt(p) * Math.PI)
  return { x: -.4 * sweep, y: .2 * Math.sin(Math.sqrt(p) * Math.PI * 2), z: -.2 * Math.sin(p * Math.PI), rotateX: -80 * sweep, rotateY: -20 * Math.sin(p * p * Math.PI), rotateZ: -20 * sweep }
}
export function hitsCenter(mask: PersonMask, age = 0) {
  const x = Math.floor(mask.width / 2), y = Math.floor(mask.height / 2)
  return age >= 0 && age < 600 && mask.width > 0 && mask.height > 0 && mask.data[y * mask.width + x] === 1
}
