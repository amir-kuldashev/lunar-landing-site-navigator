import type { HorizonProfile } from './types'
import { DEG, R_MOON_KM } from './frames'

/** Default observer height above the ground (antenna / solar panel mast), metres. */
export const DEFAULT_MAST_M = 2

/** Dip of a smooth-sphere horizon for an observer `mast_m` above the surface, degrees (negative). */
export function sphereHorizon(mast_m = DEFAULT_MAST_M): number {
  return -Math.acos(R_MOON_KM / (R_MOON_KM + mast_m / 1000)) / DEG
}

/** Skyline elevation at an azimuth: terrain profile if available, otherwise the smooth-sphere dip. */
export function horizonElevation(profile: HorizonProfile | undefined, azDeg: number): number {
  if (!profile || profile.elev_deg.length === 0) return sphereHorizon()
  const n = profile.elev_deg.length
  const x = (((azDeg % 360) + 360) % 360) / profile.az_step_deg
  const i = Math.floor(x) % n
  const j = (i + 1) % n
  const f = x - Math.floor(x)
  return profile.elev_deg[i] + (profile.elev_deg[j] - profile.elev_deg[i]) * f
}

/**
 * Fraction of a disk's area above the skyline, treating the skyline as a straight
 * horizontal line across the disk. `el` is the disk centre elevation.
 */
export function diskVisibleFraction(el: number, radius: number, horizonEl: number): number {
  const d = el - horizonEl
  if (d >= radius) return 1
  if (d <= -radius) return 0
  const hidden = radius * radius * Math.acos(d / radius) - d * Math.sqrt(radius * radius - d * d)
  return 1 - hidden / (Math.PI * radius * radius)
}
