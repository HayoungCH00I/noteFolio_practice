import type { Figure, PosePreset } from './pose-wall-presets.ts'

export type Point = { x: number; y: number }
export type BodyMask = { width: number; height: number; data: Uint8Array }
export type WallOpening = BodyMask & {
  left: number; top: number; frameWidth: number; frameHeight: number
  figures: Point[][]
}

export function makeOpening(preset: PosePreset, imageWidth: number, imageHeight: number): WallOpening {
  const frameWidth = 176, frameHeight = Math.max(1, Math.round(frameWidth * imageHeight / imageWidth))
  const joints = preset.figures.flat()
  const xs = joints.map(([x]) => x), ys = joints.map(([, y]) => y)
  const left = Math.min(...xs) - 10, right = Math.max(...xs) + 10
  const top = Math.min(...ys) - 11, bottom = Math.max(...ys) + 8
  const unit = Math.min(frameWidth * .9 / (right - left), frameHeight * .78 / (bottom - top))
  const width = Math.ceil((right - left) * unit), height = Math.ceil((bottom - top) * unit)
  const ankles = preset.figures.flatMap(figure => [figure[9][1], figure[12][1]])
  const offsetX = Math.floor((frameWidth - width) / 2)
  const offsetY = Math.max(1, Math.floor(frameHeight * .865 - (Math.max(...ankles) - top) * unit))
  const data = new Uint8Array(width * height)
  const figures = preset.figures.map(figure => {
    const points = rasterizeFigure(figure)
    return points.map(({ x, y }) => ({ x: (x + offsetX) / frameWidth, y: (y + offsetY) / frameHeight }))
  })
  return { width, height, data, left: offsetX / frameWidth, top: offsetY / frameHeight, frameWidth, frameHeight, figures }

  function rasterizeFigure(figure: Figure) {
    const points = figure.map(([x, y]) => ({ x: (x - left) * unit, y: (y - top) * unit }))
    const [head, ls, le, lw, rs, re, rw, lh, lk, la, rh, rk, ra] = points
    const shoulder = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 }
    const hip = { x: (lh.x + rh.x) / 2, y: (lh.y + rh.y) / 2 }
    const segment = (a: Point, b: Point, radius: number) => {
      const r = radius * unit
      for (let y = Math.max(0, Math.floor(Math.min(a.y, b.y) - r)); y < Math.min(height, Math.ceil(Math.max(a.y, b.y) + r)); y++) {
        for (let x = Math.max(0, Math.floor(Math.min(a.x, b.x) - r)); x < Math.min(width, Math.ceil(Math.max(a.x, b.x) + r)); x++) {
          const dx = b.x - a.x, dy = b.y - a.y
          const t = Math.max(0, Math.min(1, ((x + .5 - a.x) * dx + (y + .5 - a.y) * dy) / (dx * dx + dy * dy || 1)))
          if (Math.hypot(x + .5 - a.x - dx * t, y + .5 - a.y - dy * t) <= r) data[y * width + x] = 255
        }
      }
    }
    // Overlapping capsules keep bent, crossed and partly occluded limbs connected.
    segment(head, { x: head.x, y: head.y + 3 * unit }, 8.5)
    segment(head, shoulder, 5.8)
    segment(ls, rs, 7.2)
    segment(lh, rh, 7.6)
    segment(shoulder, hip, 10.8)
    segment(ls, lh, 6.7)
    segment(rs, rh, 6.7)
    segment(ls, le, 5.7); segment(le, lw, 5)
    segment(rs, re, 5.7); segment(re, rw, 5)
    segment(lh, lk, 7); segment(lk, la, 5.8)
    segment(rh, rk, 7); segment(rk, ra, 5.8)
    return points
  }
}
