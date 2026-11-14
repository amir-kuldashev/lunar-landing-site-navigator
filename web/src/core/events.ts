import type { Ephemeris, Events, Interval, Site, Summary } from './types'
import { getEphemeris } from './ephemeris'
import { topo } from './topo'

const MIN = 60000
const HOUR = 3600000
const DAY = 86400000

export interface EventOptions {
  /** Sampling step, minutes. Default 10. */
  stepMin?: number
  ephem?: Ephemeris
}

type Predicate = (t: number) => boolean

/** Find the time of a state change between lo and hi (states differ) to within a second. */
function bisect(pred: Predicate, lo: number, hi: number, stateLo: boolean): number {
  while (hi - lo > 1000) {
    const mid = (lo + hi) / 2
    if (pred(mid) === stateLo) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

function intervals(pred: Predicate, t0: number, t1: number, step: number): Interval[] {
  const out: Interval[] = []
  let prevT = t0
  let prev = pred(t0)
  let start: number | null = prev ? t0 : null
  let openStart = prev
  for (let t = t0 + step; prevT < t1; t += step) {
    const tt = Math.min(t, t1)
    const cur = pred(tt)
    if (cur !== prev) {
      const x = bisect(pred, prevT, tt, prev)
      if (cur) {
        start = x
        openStart = false
      } else if (start !== null) {
        out.push({ start, end: x, openStart, openEnd: false })
        start = null
      }
    }
    prev = cur
    prevT = tt
  }
  if (start !== null) out.push({ start, end: t1, openStart, openEnd: true })
  return out
}

/** First real end (set) and first real start (rise) after t0. */
function nextTransitions(list: Interval[]): { set: number | null; rise: number | null } {
  const set = list.find((i) => !i.openEnd)?.end ?? null
  const rise = list.find((i) => !i.openStart)?.start ?? null
  return { set, rise }
}

/** Sunlight and direct-to-Earth windows at a site between t0 and t1 (ms UTC). */
export function events(site: Site, t0: number, t1: number, opts: EventOptions = {}): Events {
  const ephem = opts.ephem ?? getEphemeris()
  const step = (opts.stepMin ?? 10) * MIN
  const sunlight = intervals((t) => topo(site, t, ephem).sun.visibleFraction > 0, t0, t1, step)
  const dte = intervals((t) => topo(site, t, ephem).earth.visible, t0, t1, step)
  const s = nextTransitions(sunlight)
  const e = nextTransitions(dte)
  return { sunlight, dte, nextSunset: s.set, nextSunrise: s.rise, nextEarthset: e.set, nextEarthrise: e.rise }
}

function longestGap(list: Interval[], t0: number, t1: number): number {
  let gap = 0
  let cursor = t0
  for (const i of list) {
    gap = Math.max(gap, i.start - cursor)
    cursor = i.end
  }
  return Math.max(gap, t1 - cursor) / HOUR
}

/** Headline numbers for a site over `days` starting at t0. */
export function summary(site: Site, t0: number, days = 30, opts: EventOptions = {}): Summary {
  const ephem = opts.ephem ?? getEphemeris()
  const step = (opts.stepMin ?? 20) * MIN
  const t1 = t0 + days * DAY
  let n = 0
  let lit = 0
  let frac = 0
  let dte = 0
  let both = 0
  let maxSunEl = -90
  let minSunEl = 90
  for (let t = t0; t <= t1; t += step) {
    const v = topo(site, t, ephem)
    const isLit = v.sun.visibleFraction > 0
    n++
    if (isLit) lit++
    frac += v.sun.visibleFraction
    if (v.earth.visible) dte++
    if (isLit && v.earth.visible) both++
    maxSunEl = Math.max(maxSunEl, v.sun.el)
    minSunEl = Math.min(minSunEl, v.sun.el)
  }
  const ev = events(site, t0, t1, { ephem, stepMin: opts.stepMin ?? 20 })
  return {
    litPct: (100 * lit) / n,
    meanSolarPct: (100 * frac) / n,
    dtePct: (100 * dte) / n,
    bothPct: (100 * both) / n,
    longestNight_h: longestGap(ev.sunlight, t0, t1),
    longestDteGap_h: longestGap(ev.dte, t0, t1),
    maxSunEl,
    minSunEl,
  }
}
