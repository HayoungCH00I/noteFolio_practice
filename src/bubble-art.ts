export const bubbleShapes = ['heart', 'star', 'square', 'circle'] as const
export const bubbleColors = ['blue', 'green', 'yellow', 'pink'] as const
export type BubbleShape = typeof bubbleShapes[number]
export type BubbleColor = typeof bubbleColors[number]
export interface BubbleAppearance { shape: BubbleShape; color: BubbleColor }
export const shapeNames: Record<BubbleShape, string> = { heart: '하트', star: '별', square: '네모', circle: '원' }
export const colorNames: Record<BubbleColor, string> = { blue: '블루', green: '그린', yellow: '옐로우', pink: '핑크' }

function shuffled<T>(items: T[]): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const item = result[i]!
    result[i] = result[j]!
    result[j] = item
  }
  return result
}

/** All sixteen combinations occur evenly, then their screen positions are shuffled. */
export function createBubbleLayout(count: number): BubbleAppearance[] {
  const combinations = shuffled(bubbleShapes.flatMap(shape => bubbleColors.map(color => ({ shape, color }))))
  return shuffled(Array.from({ length: count }, (_, i) => ({ ...combinations[i % combinations.length]! })))
}

const outlines: Record<BubbleShape, string> = {
  heart: 'M50 85C42 77 10 57 10 33C10 9 37 5 50 25C63 5 90 9 90 33C90 57 58 78 50 85Z',
  star: 'M50 8L61 34L90 37L68 56L75 85L50 70L25 85L32 56L10 37L39 34Z',
  square: 'M26 12H74Q88 12 88 26V74Q88 88 74 88H26Q12 88 12 74V26Q12 12 26 12Z',
  circle: 'M50 10A40 40 0 1 1 49.99 10Z',
}
const palette: Record<BubbleColor, { light: string; middle: string; dark: string }> = {
  blue: { light: '#edf6ff', middle: '#afcfe8', dark: '#739ebc' },
  green: { light: '#edfaf1', middle: '#b4d8c6', dark: '#7ba890' },
  yellow: { light: '#fff9df', middle: '#efdfa1', dark: '#c4ac63' },
  pink: { light: '#fff0f6', middle: '#e7b9cd', dark: '#bf8ca6' },
}
const cache = new Map<string, { inflated: string; deflated: string }>()

export function bubbleArtwork({ shape, color }: BubbleAppearance) {
  const key = `${shape}-${color}`
  const previous = cache.get(key)
  if (previous) return previous
  const p = palette[color]
  const path = outlines[shape]
  const artwork = (flat: boolean) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="0.8" y2="1"><stop stop-color="${p.light}"/><stop offset=".45" stop-color="${p.middle}"/><stop offset="1" stop-color="${p.dark}"/></linearGradient>
        <radialGradient id="gloss" cx=".32" cy=".2" r=".8"><stop stop-color="white" stop-opacity=".8"/><stop offset=".5" stop-color="white" stop-opacity=".08"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>
        <clipPath id="shape"><path d="${path}"/></clipPath>
      </defs>
      ${flat ? `<path d="${path}" fill="${p.middle}" fill-opacity=".3" stroke="${p.dark}" stroke-opacity=".4" stroke-width="1.3"/>
        <g clip-path="url(#shape)" fill="none" stroke="${p.dark}" stroke-opacity=".3" stroke-width="1.4"><path d="M24 44Q40 55 51 47T79 58M40 23Q55 41 46 77M22 72Q39 58 68 73"/></g>`
        : `<path d="${path}" fill="url(#body)" stroke="${p.dark}" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="${path}" fill="url(#gloss)" stroke="white" stroke-opacity=".75" stroke-width=".8" stroke-linejoin="round"/>
        <g clip-path="url(#shape)"><ellipse cx="34" cy="24" rx="17" ry="7" fill="white" fill-opacity=".6" transform="rotate(-28 34 24)"/><ellipse cx="67" cy="73" rx="12" ry="4" fill="white" fill-opacity=".3" transform="rotate(-30 67 73)"/></g>`}
    </svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  }
  const result = { inflated: artwork(false), deflated: artwork(true) }
  cache.set(key, result)
  return result
}
