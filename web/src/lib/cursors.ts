/**
 * Pointers for the 3D Moon: a targeting reticle in place of the plain arrow.
 *   idle  a ring with four ticks: you are aiming at the surface
 *   drag  the reticle closes up while the Moon is being turned
 *   lock  it turns sunlight-yellow and gains corner brackets over a landing site you can select
 * Each is a small SVG with a dark underlay so it shows on both the lit and the night side.
 * The fallback keyword after each one is used if the image cannot load.
 */
const svg = (body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 36 36' fill='none' stroke-linecap='round'>${body}</svg>`,
  )}") 18 18`

const twice = (shape: (stroke: string, width: number) => string, color: string) =>
  shape('rgba(0,0,0,0.75)', 4) + shape(color, 1.6)

const ticks = (inner: number, outer: number) => (stroke: string, w: number) =>
  `<path stroke='${stroke}' stroke-width='${w}' d='M18 ${18 - outer}V${18 - inner}M18 ${18 + inner}V${18 + outer}M${18 - outer} 18H${18 - inner}M${18 + inner} 18H${18 + outer}'/>`
const ring = (r: number) => (stroke: string, w: number) => `<circle cx='18' cy='18' r='${r}' stroke='${stroke}' stroke-width='${w}'/>`
const dot = (r: number, color: string) => `<circle cx='18' cy='18' r='${r + 1.2}' fill='rgba(0,0,0,0.75)'/><circle cx='18' cy='18' r='${r}' fill='${color}'/>`
const brackets = (stroke: string, w: number) =>
  `<path stroke='${stroke}' stroke-width='${w}' stroke-linejoin='round' d='M5 11V5H11M25 5H31V11M31 25V31H25M11 31H5V25'/>`

const INK = '#eceae4'
const SUN = '#f4c55a'

export const MOON_CURSOR = {
  idle: `${svg(twice(ring(9), INK) + twice(ticks(12, 16), INK) + dot(1.4, INK))}, crosshair`,
  drag: `${svg(twice(ring(6), INK) + twice(ticks(8, 11), INK) + dot(2.2, INK))}, grabbing`,
  lock: `${svg(twice(brackets, SUN) + twice(ring(7), SUN) + dot(2, SUN))}, pointer`,
}
