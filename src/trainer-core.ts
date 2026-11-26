import type { Point } from './fruit-game-core.ts'
import type { TrackingSample } from './fruit-vision.ts'

export const trainerTitle = '포켓몬스터 : 트레이너들의 역습'
export const maxHp = 100
export const captureHp = 25
export const teamSize = 6
export type Capture = { name: string; date: string; photo?: string }
type Mask = NonNullable<TrackingSample['mask']>

export function personAt(mask: Mask, point: Point, videoWidth: number, videoHeight: number, width: number, height: number, radius = 0, mirrored = true) {
  return personContact(mask, point, videoWidth, videoHeight, width, height, radius, mirrored) !== -1
}

export function personContact(mask: Mask, point: Point, videoWidth: number, videoHeight: number, width: number, height: number, radius: number, mirrored: boolean) {
  if (!videoWidth || !videoHeight || !width || !height || !mask.width || !mask.height) return -1
  const scale = Math.max(width / videoWidth, height / videoHeight)
  const drawnWidth = videoWidth * scale, drawnHeight = videoHeight * scale
  const cellWidth = drawnWidth / mask.width, cellHeight = drawnHeight / mask.height
  const screenX = mirrored ? width - point.x : point.x
  const x = (screenX + (drawnWidth - width) / 2) / cellWidth
  const y = (point.y + (drawnHeight - height) / 2) / cellHeight
  const left = Math.max(0, Math.floor(x - radius / cellWidth))
  const right = Math.min(mask.width - 1, Math.floor(x + radius / cellWidth))
  const top = Math.max(0, Math.floor(y - radius / cellHeight))
  const bottom = Math.min(mask.height - 1, Math.floor(y + radius / cellHeight))
  let hit = -1, distance = radius * radius
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      const index = row * mask.width + col
      if (mask.data[index] !== 1) continue
      const dx = Math.max(col - x, 0, x - col - 1) * cellWidth
      const dy = Math.max(row - y, 0, y - row - 1) * cellHeight
      const squared = dx * dx + dy * dy
      if (squared <= distance) {
        hit = index
        distance = squared
        if (distance === 0) return hit
      }
    }
  }
  return hit
}

export function personCutout(mask: Mask, hit: number) {
  const { width, height, data } = mask
  if (data[hit] !== 1) return undefined
  let left = width, right = 0, top = height, bottom = 0
  const pixels = new Uint8Array(data.length)
  const queue = [hit]
  pixels[hit] = 1
  for (let i = 0; i < queue.length; i++) {
    const index = queue[i]!, x = index % width, y = Math.floor(index / width)
    left = Math.min(left, x); right = Math.max(right, x)
    top = Math.min(top, y); bottom = Math.max(bottom, y)
    for (const neighbor of [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, index - width, index + width]) {
      if (data[neighbor] !== 1 || pixels[neighbor]) continue
      pixels[neighbor] = 1
      queue.push(neighbor)
    }
  }
  return { pixels, x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
}

export function ballAt(origin: Point, swipe: Point, height: number, progress: number): Point {
  return {
    x: origin.x + swipe.x * 2 * progress,
    y: origin.y + Math.min(swipe.y * 2, -.58 * height) * progress - .48 * height * progress * (1 - progress),
  }
}

export function readCaptures(value: string | null): Capture[] {
  try {
    const entries: unknown = JSON.parse(value ?? '[]')
    if (!Array.isArray(entries)) return []
    const captures: Capture[] = []
    for (const entry of entries) {
      if (!entry || typeof entry.name !== 'string' || typeof entry.date !== 'string') continue
      const { name, date, photo } = entry
      const capture: Capture = { name, date }
      if (typeof photo === 'string' && /^data:image\/(?:webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)) capture.photo = photo
      captures.push(capture)
    }
    return captures
  } catch { return [] }
}
