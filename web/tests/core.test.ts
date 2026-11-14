import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  azElRange,
  diskVisibleFraction,
  events,
  MockEphemeris,
  sphereHorizon,
  summary,
  TableEphemeris,
  topo,
  type Site,
} from '../src/core'

const path = (rel: string) => fileURLToPath(new URL(rel, import.meta.url))

describe('frames', () => {
  it('puts a body straight overhead at elevation 90', () => {
    const v = azElRange(0, 0, 0, [400000, 0, 0])
    expect(v.el).toBeCloseTo(90, 6)
  })
  it('measures azimuth from north through east', () => {
    // From the sub-Earth point, a body over +Z (north pole direction) is due north, over +Y due east.
    expect(azElRange(0, 0, 0, [1737.4, 0, 1e6]).az).toBeCloseTo(0, 6)
    expect(azElRange(0, 0, 0, [1737.4, 1e6, 0]).az).toBeCloseTo(90, 6)
  })
})

describe('horizon', () => {
  it('smooth-sphere dip for a 2 m mast is small and negative', () => {
    expect(sphereHorizon(2)).toBeCloseTo(-0.0869, 3)
  })
  it('disk fraction is 0, 0.5, 1 at the obvious places', () => {
    expect(diskVisibleFraction(-1, 0.27, 0)).toBe(0)
    expect(diskVisibleFraction(0, 0.27, 0)).toBeCloseTo(0.5, 9)
    expect(diskVisibleFraction(1, 0.27, 0)).toBe(1)
  })
})

describe('events on the mock ephemeris', () => {
  const site: Site = { id: 'eq', name: 'Equator', lat: 0, lon: 20, alt_m: 0 }
  const ephem = new MockEphemeris()
  const t0 = Date.UTC(2027, 0, 1)
  it('finds about one day/night cycle per synodic month at the equator', () => {
    const ev = events(site, t0, t0 + 60 * 86400000, { ephem })
    const full = ev.sunlight.filter((i) => !i.openStart && !i.openEnd)
    expect(full.length).toBeGreaterThanOrEqual(1)
    const hours = (full[0].end - full[0].start) / 3600000
    expect(hours).toBeGreaterThan(340)
    expect(hours).toBeLessThan(370)
    const s = summary(site, t0, 59, { ephem })
    expect(s.litPct).toBeGreaterThan(45)
    expect(s.litPct).toBeLessThan(55)
    expect(s.dtePct).toBe(100)
  })
})

// Ground truth: JPL Horizons. Needs web/public/data/ephem.bin (uv run pipeline/build_ephem.py).
const binPath = path('../public/data/ephem.bin')
const fixturePath = path('../src/core/fixtures/horizons.json')
const haveData = existsSync(binPath) && existsSync(fixturePath)

describe.skipIf(!haveData)('topo() against JPL Horizons', () => {
  it('matches azimuth and elevation within 0.05 degrees', () => {
    const header = JSON.parse(readFileSync(path('../public/data/ephem.json'), 'utf8'))
    const buf = readFileSync(binPath)
    const ephem = new TableEphemeris(header, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
    const fx = JSON.parse(readFileSync(fixturePath, 'utf8'))
    let worstAz = 0
    let worstEl = 0
    let n = 0
    for (const c of fx.cases) {
      const site: Site = { id: c.site, name: c.site, lat: c.lat, lon: c.lon, alt_m: c.alt_m }
      for (const row of c.rows) {
        const v = topo(site, Date.parse(row.t), ephem)[c.body as 'sun' | 'earth']
        // Compare azimuth as an on-sky angle so it stays meaningful near the zenith.
        let dAz = Math.abs(v.az - row.az)
        if (dAz > 180) dAz = 360 - dAz
        dAz *= Math.cos((row.el * Math.PI) / 180)
        worstAz = Math.max(worstAz, dAz)
        worstEl = Math.max(worstEl, Math.abs(v.el - row.el))
        n++
      }
    }
    console.log(`Horizons check: ${n} rows, worst az error ${worstAz.toFixed(4)} deg, worst el error ${worstEl.toFixed(4)} deg`)
    expect(n).toBeGreaterThan(100)
    expect(worstEl).toBeLessThan(0.05)
    expect(worstAz).toBeLessThan(0.05)
  })
})
