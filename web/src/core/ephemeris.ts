import type { Ephemeris, Vec3 } from './types'
import { DEG } from './frames'

export interface EphemHeader {
  /** ISO time of the first sample, UTC. */
  t0_utc: string
  step_s: number
  n: number
  frame?: string
  source?: string
}

/**
 * SPICE-derived table: n records of 6 little-endian float32
 * [sunX, sunY, sunZ, earthX, earthY, earthZ] in km, Moon Mean-Earth body-fixed frame.
 * Built by pipeline/build_ephem.py.
 */
export class TableEphemeris implements Ephemeris {
  readonly approximate = false
  readonly range: [number, number]
  private readonly data: Float32Array
  private readonly t0: number
  private readonly stepMs: number
  private readonly n: number

  constructor(header: EphemHeader, buffer: ArrayBuffer) {
    this.data = new Float32Array(buffer)
    this.n = header.n
    if (this.data.length < this.n * 6) throw new Error('ephem.bin is shorter than its header says')
    this.t0 = Date.parse(header.t0_utc)
    this.stepMs = header.step_s * 1000
    this.range = [this.t0, this.t0 + (this.n - 1) * this.stepMs]
  }

  sunEarth(tMs: number): { sun: Vec3; earth: Vec3 } {
    const x = Math.min(Math.max((tMs - this.t0) / this.stepMs, 0), this.n - 1)
    const i = Math.min(Math.floor(x), this.n - 2)
    const f = x - i
    const a = i * 6
    const b = a + 6
    const d = this.data
    const lerp = (k: number) => d[a + k] + (d[b + k] - d[a + k]) * f
    return { sun: [lerp(0), lerp(1), lerp(2)], earth: [lerp(3), lerp(4), lerp(5)] }
  }
}

const DAY_MS = 86400000
const NEW_MOON_2000 = Date.UTC(2000, 0, 6, 18, 14)
const SYNODIC_D = 29.530589
const DRACONIC_YEAR_D = 346.62
const ANOMALISTIC_D = 27.554551
const DRACONIC_MONTH_D = 27.212221

/**
 * Rough analytical stand-in so the UI works before ephem.bin exists.
 * Good to a few degrees only. Never use it for numbers shown as results.
 */
export class MockEphemeris implements Ephemeris {
  readonly approximate = true
  readonly range: [number, number] = [Date.UTC(1970, 0, 1), Date.UTC(2100, 0, 1)]

  sunEarth(tMs: number): { sun: Vec3; earth: Vec3 } {
    const days = (tMs - NEW_MOON_2000) / DAY_MS
    // Sub-solar point: over the far side at new moon, moving west one turn per synodic month.
    const sunLon = (180 - (360 * days) / SYNODIC_D) * DEG
    const sunLat = 1.54 * Math.sin((2 * Math.PI * days) / DRACONIC_YEAR_D) * DEG
    // Sub-Earth point wobbles with libration.
    const earthLon = 6.3 * Math.sin((2 * Math.PI * days) / ANOMALISTIC_D) * DEG
    const earthLat = 6.7 * Math.sin((2 * Math.PI * days) / DRACONIC_MONTH_D) * DEG
    const dir = (lat: number, lon: number, r: number): Vec3 => [
      r * Math.cos(lat) * Math.cos(lon),
      r * Math.cos(lat) * Math.sin(lon),
      r * Math.sin(lat),
    ]
    return { sun: dir(sunLat, sunLon, 1.496e8), earth: dir(earthLat, earthLon, 384400) }
  }
}

let active: Ephemeris = new MockEphemeris()

export function getEphemeris(): Ephemeris {
  return active
}

export function setEphemeris(e: Ephemeris): void {
  active = e
}

/** Load the SPICE table from /data. Falls back to the mock (and returns it) if the files are missing. */
export async function loadEphemeris(baseUrl = `${import.meta.env.BASE_URL}data`): Promise<Ephemeris> {
  try {
    const [h, b] = await Promise.all([fetch(`${baseUrl}/ephem.json`), fetch(`${baseUrl}/ephem.bin`)])
    if (!h.ok || !b.ok) throw new Error('ephemeris files not found')
    active = new TableEphemeris((await h.json()) as EphemHeader, await b.arrayBuffer())
  } catch (err) {
    console.warn('Using approximate mock ephemeris:', err)
    active = new MockEphemeris()
  }
  return active
}
