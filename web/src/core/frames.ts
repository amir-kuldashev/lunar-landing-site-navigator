import type { Vec3 } from './types'

export const R_MOON_KM = 1737.4
export const R_SUN_KM = 695700
export const R_EARTH_KM = 6378.137

export const DEG = Math.PI / 180

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const norm = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])

/** Position of a surface site in the Moon body-fixed frame, km. */
export function siteVector(latDeg: number, lonDeg: number, alt_m = 0): Vec3 {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  const r = R_MOON_KM + alt_m / 1000
  return [r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)]
}

/** Local East / North / Up unit vectors at a site, expressed in the body-fixed frame. */
export function enuBasis(latDeg: number, lonDeg: number): { east: Vec3; north: Vec3; up: Vec3 } {
  const lat = latDeg * DEG
  const lon = lonDeg * DEG
  const sl = Math.sin(lat)
  const cl = Math.cos(lat)
  const so = Math.sin(lon)
  const co = Math.cos(lon)
  return {
    east: [-so, co, 0],
    north: [-sl * co, -sl * so, cl],
    up: [cl * co, cl * so, sl],
  }
}

/**
 * Azimuth (0 = north, clockwise through east), elevation and range of a body
 * as seen from a site. `body` is the body's position from the Moon's centre, body-fixed, km.
 */
export function azElRange(
  latDeg: number,
  lonDeg: number,
  alt_m: number,
  body: Vec3,
): { az: number; el: number; range: number } {
  const d = sub(body, siteVector(latDeg, lonDeg, alt_m))
  const { east, north, up } = enuBasis(latDeg, lonDeg)
  const range = norm(d)
  const e = dot(d, east)
  const n = dot(d, north)
  const u = dot(d, up)
  let az = Math.atan2(e, n) / DEG
  if (az < 0) az += 360
  return { az, el: Math.asin(u / range) / DEG, range }
}

/** Latitude and east longitude of the point directly under a body (sub-solar or sub-Earth point). */
export function subPoint(body: Vec3): { lat: number; lon: number } {
  const r = norm(body)
  return { lat: Math.asin(body[2] / r) / DEG, lon: Math.atan2(body[1], body[0]) / DEG }
}
