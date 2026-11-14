import type { Ephemeris, HorizonProfile } from './types'
import { DEG, R_MOON_KM, R_SUN_KM } from './frames'
import { getEphemeris } from './ephemeris'
import { diskVisibleFraction } from './horizon'

/**
 * A regular grid of terrain skylines over the south polar region, built by pipeline/build_polar_grid.py.
 * Lets the app score every cell for a date instead of only named sites.
 */
export interface PolarGrid {
  n: number
  azN: number
  spacingKm: number
  latMax: number
  mastM: number
  lat: Float32Array
  lon: Float32Array
  /** Terrain height above the 1737.4 km sphere, metres. */
  height: Int16Array
  /** Mean slope inside the cell, in units of slopeUnit degrees. */
  slope: Uint8Array
  slopeUnit: number
  /** n * azN skyline elevations, in units of skylineUnit degrees, north first, clockwise. */
  skyline: Int8Array
  skylineUnit: number
}

interface GridHeader {
  n: number
  az_n: number
  spacing_km: number
  lat_max: number
  mast_m: number
  offsets: { lat: number; lon: number; height_m: number; slope: number; skyline: number }
  slope_unit_deg: number
  skyline_unit_deg: number
}

export async function loadPolarGrid(baseUrl = `${import.meta.env.BASE_URL}data`): Promise<PolarGrid> {
  const [h, b] = await Promise.all([fetch(`${baseUrl}/polar_grid.json`), fetch(`${baseUrl}/polar_grid.bin`)])
  if (!h.ok || !b.ok) throw new Error('The south-pole terrain grid could not be loaded')
  return parsePolarGrid((await h.json()) as GridHeader, await b.arrayBuffer())
}

export function parsePolarGrid(header: GridHeader, buf: ArrayBuffer): PolarGrid {
  const { n, az_n: azN, offsets: o } = header
  return {
    n,
    azN,
    spacingKm: header.spacing_km,
    latMax: header.lat_max,
    mastM: header.mast_m,
    lat: new Float32Array(buf, o.lat, n),
    lon: new Float32Array(buf, o.lon, n),
    height: new Int16Array(buf, o.height_m, n),
    slope: new Uint8Array(buf, o.slope, n),
    slopeUnit: header.slope_unit_deg,
    skyline: new Int8Array(buf, o.skyline, n * azN),
    skylineUnit: header.skyline_unit_deg,
  }
}

/** The skyline of one grid cell as a horizon profile, so the cell can be opened like any site. */
export function gridHorizon(grid: PolarGrid, i: number): HorizonProfile {
  const elev = new Array<number>(grid.azN)
  for (let a = 0; a < grid.azN; a++) elev[a] = grid.skyline[i * grid.azN + a] * grid.skylineUnit
  return {
    az_step_deg: 360 / grid.azN,
    mast_m: grid.mastM,
    elev_deg: elev,
    resolution_m: grid.spacingKm * 1000,
    site_height_m: grid.height[i],
    source: 'South-pole terrain grid (LOLA)',
  }
}

export interface GridScores {
  /** Average visible share of the Sun's disk, percent. */
  solar: Float32Array
  /** Share of the time Earth's centre is above the skyline, percent. */
  dte: Float32Array
  /** Share of the time with both, percent. */
  both: Float32Array
  /** Weighted score, 0..100. */
  score: Float32Array
  /** 1 where any of the Sun is above the skyline at t0. */
  litAtArrival: Uint8Array
}

/**
 * Sunlight and Earth-contact figures for every grid cell over `days` from t0.
 * Same geometry as topo(), written as one tight loop: the Sun and Earth vectors are looked up once per
 * time step and reused for every cell.
 */
export function scoreGrid(
  grid: PolarGrid,
  t0: number,
  days: number,
  weights: [solar: number, dte: number, both: number],
  stepHours = 2,
  ephem: Ephemeris = getEphemeris(),
): GridScores {
  const steps = Math.max(1, Math.round((days * 24) / stepHours))
  const sun = new Float64Array(steps * 3)
  const earth = new Float64Array(steps * 3)
  for (let k = 0; k < steps; k++) {
    const v = ephem.sunEarth(t0 + k * stepHours * 3600000)
    sun.set(v.sun, k * 3)
    earth.set(v.earth, k * 3)
  }

  const { n, azN } = grid
  const azStep = 360 / azN
  const out: GridScores = {
    solar: new Float32Array(n),
    dte: new Float32Array(n),
    both: new Float32Array(n),
    score: new Float32Array(n),
    litAtArrival: new Uint8Array(n),
  }

  const skyAt = (row: number, azDeg: number) => {
    const x = azDeg / azStep
    const i0 = Math.floor(x) % azN
    const i1 = (i0 + 1) % azN
    const f = x - Math.floor(x)
    return (grid.skyline[row + i0] + (grid.skyline[row + i1] - grid.skyline[row + i0]) * f) * grid.skylineUnit
  }

  for (let i = 0; i < n; i++) {
    const lat = grid.lat[i] * DEG
    const lon = grid.lon[i] * DEG
    const sl = Math.sin(lat)
    const cl = Math.cos(lat)
    const so = Math.sin(lon)
    const co = Math.cos(lon)
    const r = R_MOON_KM + grid.height[i] / 1000
    const px = r * cl * co
    const py = r * cl * so
    const pz = r * sl
    const row = i * azN
    let solar = 0
    let dte = 0
    let both = 0

    for (let k = 0; k < steps; k++) {
      const j = k * 3
      // Sun
      let dx = sun[j] - px
      let dy = sun[j + 1] - py
      let dz = sun[j + 2] - pz
      let range = Math.sqrt(dx * dx + dy * dy + dz * dz)
      let e = -so * dx + co * dy
      let nn = -sl * co * dx - sl * so * dy + cl * dz
      let u = cl * co * dx + cl * so * dy + sl * dz
      let az = Math.atan2(e, nn) / DEG
      if (az < 0) az += 360
      const sunEl = Math.asin(u / range) / DEG
      const frac = diskVisibleFraction(sunEl, Math.asin(R_SUN_KM / range) / DEG, skyAt(row, az))
      // Earth
      dx = earth[j] - px
      dy = earth[j + 1] - py
      dz = earth[j + 2] - pz
      range = Math.sqrt(dx * dx + dy * dy + dz * dz)
      e = -so * dx + co * dy
      nn = -sl * co * dx - sl * so * dy + cl * dz
      u = cl * co * dx + cl * so * dy + sl * dz
      az = Math.atan2(e, nn) / DEG
      if (az < 0) az += 360
      const earthUp = Math.asin(u / range) / DEG > skyAt(row, az)

      solar += frac
      if (earthUp) dte++
      if (frac > 0 && earthUp) both++
      if (k === 0 && frac > 0) out.litAtArrival[i] = 1
    }
    out.solar[i] = (100 * solar) / steps
    out.dte[i] = (100 * dte) / steps
    out.both[i] = (100 * both) / steps
    out.score[i] = weights[0] * out.solar[i] + weights[1] * out.dte[i] + weights[2] * out.both[i]
  }
  return out
}
