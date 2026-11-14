/**
 * Core astronomy API. Views import from here and nowhere else in core/.
 *
 *   topo(site, t)            where the Sun and Earth are in the site's sky
 *   events(site, t0, t1)     sunlight and direct-to-Earth windows, next rise/set times
 *   summary(site, t0, days)  headline percentages for a date range
 *
 * Call loadEphemeris() once at startup. Until ephem.bin exists it falls back to a
 * rough mock; check getEphemeris().approximate and label the UI accordingly.
 */
export * from './types'
export { topo } from './topo'
export { events, summary } from './events'
export type { EventOptions } from './events'
export { loadEphemeris, getEphemeris, setEphemeris, TableEphemeris, MockEphemeris } from './ephemeris'
export { horizonElevation, sphereHorizon, diskVisibleFraction, DEFAULT_MAST_M } from './horizon'
export { subPoint, siteVector, azElRange, R_MOON_KM } from './frames'
export { loadPolarGrid, parsePolarGrid, gridHorizon, scoreGrid } from './grid'
export type { PolarGrid, GridScores } from './grid'
