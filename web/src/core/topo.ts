import type { BodyView, Ephemeris, Site, Topo } from './types'
import { azElRange, DEG, R_EARTH_KM, R_SUN_KM } from './frames'
import { getEphemeris } from './ephemeris'
import { diskVisibleFraction, horizonElevation } from './horizon'

function view(site: Site, body: [number, number, number], bodyRadiusKm: number): BodyView {
  const { az, el, range } = azElRange(site.lat, site.lon, site.alt_m, body)
  const radius = Math.asin(bodyRadiusKm / range) / DEG
  const horizonEl = horizonElevation(site.horizon, az)
  return { az, el, radius, horizonEl, visibleFraction: diskVisibleFraction(el, radius, horizonEl), distance_km: range }
}

/** Where the Sun and Earth are in the sky of `site` at time `t` (ms UTC or Date). */
export function topo(site: Site, t: number | Date, ephem: Ephemeris = getEphemeris()): Topo {
  const tMs = typeof t === 'number' ? t : t.getTime()
  const { sun, earth } = ephem.sunEarth(tMs)
  const e = view(site, earth, R_EARTH_KM)
  return { t: tMs, sun: view(site, sun, R_SUN_KM), earth: { ...e, visible: e.el > e.horizonEl } }
}
