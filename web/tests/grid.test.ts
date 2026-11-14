import { describe, expect, it } from 'vitest'
import { MockEphemeris, scoreGrid, topo, type PolarGrid, type Site } from '../src/core'

/** The fast grid loop must give the same answer as topo(), which is checked against JPL Horizons. */
describe('scoreGrid', () => {
  it('matches topo() for a cell with a flat skyline', () => {
    const azN = 180
    const cells = [
      { lat: -89.45, lon: 222.69, height: 1954, sky: -1.0 },
      { lat: -85.0, lon: 31.0, height: -2500, sky: 3.0 },
    ]
    const n = cells.length
    const grid: PolarGrid = {
      n,
      azN,
      spacingKm: 4,
      latMax: -83,
      mastM: 2,
      lat: Float32Array.from(cells.map((c) => c.lat)),
      lon: Float32Array.from(cells.map((c) => c.lon)),
      height: Int16Array.from(cells.map((c) => c.height)),
      slope: new Uint8Array(n),
      slopeUnit: 0.5,
      skyline: Int8Array.from(cells.flatMap((c) => new Array<number>(azN).fill(c.sky * 10))),
      skylineUnit: 0.1,
    }
    const ephem = new MockEphemeris()
    const t0 = Date.UTC(2027, 0, 1)
    const days = 30
    const stepH = 2
    const got = scoreGrid(grid, t0, days, [0.3, 0.3, 0.4], stepH, ephem)

    cells.forEach((c, i) => {
      // Float32 storage rounds the coordinates slightly, so build the site from the stored values.
      const site: Site = {
        id: 'cell',
        name: 'cell',
        lat: grid.lat[i],
        lon: grid.lon[i],
        alt_m: c.height,
        horizon: { az_step_deg: 2, mast_m: 2, elev_deg: new Array<number>(azN).fill(c.sky) },
      }
      const steps = (days * 24) / stepH
      let solar = 0
      let dte = 0
      let both = 0
      for (let k = 0; k < steps; k++) {
        const v = topo(site, t0 + k * stepH * 3600000, ephem)
        solar += v.sun.visibleFraction
        if (v.earth.visible) dte++
        if (v.sun.visibleFraction > 0 && v.earth.visible) both++
      }
      expect(got.solar[i]).toBeCloseTo((100 * solar) / steps, 3)
      expect(got.dte[i]).toBeCloseTo((100 * dte) / steps, 3)
      expect(got.both[i]).toBeCloseTo((100 * both) / steps, 3)
      expect(got.score[i]).toBeCloseTo(0.3 * got.solar[i] + 0.3 * got.dte[i] + 0.4 * got.both[i], 3)
    })
  })
})
