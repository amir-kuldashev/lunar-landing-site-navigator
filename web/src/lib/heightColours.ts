/**
 * Colour scale for terrain height, in the style of NASA's colour-coded LOLA elevation maps:
 * deep blue for the lowest ground, through green and yellow, to red and near-white for the highest.
 * The same stops drive the 3D landscape and its legend.
 */
export const HEIGHT_STOPS: [number, number, number][] = [
  [32, 52, 140], // deep blue
  [38, 148, 196], // cyan
  [58, 168, 96], // green
  [230, 212, 84], // yellow
  [228, 138, 48], // orange
  [196, 56, 44], // red
  [246, 238, 230], // near white
]

/** RGB (0..255) for a position 0..1 along the scale. */
export function heightColour(v: number): [number, number, number] {
  const x = Math.min(Math.max(v, 0), 1) * (HEIGHT_STOPS.length - 1)
  const i = Math.min(Math.floor(x), HEIGHT_STOPS.length - 2)
  const f = x - i
  const a = HEIGHT_STOPS[i]
  const b = HEIGHT_STOPS[i + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}

export const HEIGHT_GRADIENT = `linear-gradient(to right, ${HEIGHT_STOPS.map((c) => `rgb(${c.join(',')})`).join(', ')})`

/** Lowest and highest value in a block of heights. */
export function heightRange(heights: ArrayLike<number>): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < heights.length; i++) {
    if (heights[i] < lo) lo = heights[i]
    if (heights[i] > hi) hi = heights[i]
  }
  return [lo, hi]
}
