import { useId, useMemo, useRef, useState } from 'react'
import { getEphemeris, topo, type Site } from '../core'
import { DAY, HOUR, dateShortUTC, dateUTC, timeUTC } from '../lib/format'
import { priorityOf, type Mission } from '../lib/scoring'
import { useSize } from '../lib/useSize'
import MissionControls from './MissionControls'

/**
 * "When should we land here?" Scores every possible landing time at one site over the coming year,
 * for the chosen mission length and priority, and picks out the best ones. This is the question a
 * mission faces when its schedule slips and the site is fixed.
 *
 * The chart can be zoomed: pick a period, or drag across it to look at a few weeks closely.
 */

interface Props {
  site: Site
  t: number
  mission: Mission
  onMission: (m: Mission) => void
  onChange: (t: number) => void
}

const SPAN_DAYS = 365
const STEP_H = 2
const PAD = { left: 36, right: 10, top: 14, bottom: 24 }
const H = 190
const MIN_VIEW_DAYS = 5
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PERIODS = [
  { days: 365, label: '12 months' },
  { days: 183, label: '6 months' },
  { days: 91, label: '3 months' },
  { days: 30, label: '1 month' },
]

interface Pick {
  t: number
  score: number
  solar: number
  dte: number
  both: number
  lit: boolean
}

export default function BestDates({ site, t, mission, onMission, onChange }: Props) {
  const [ref, { width }] = useSize<HTMLDivElement>()
  const clipId = useId()
  const [hover, setHover] = useState<number | null>(null)
  /** The visible part of the year, as fractions of the whole span. */
  const [view, setView] = useState<[number, number]>([0, 1])
  const [brush, setBrush] = useState<[number, number] | null>(null)
  const dragFrom = useRef<number | null>(null)
  const { days, priority } = mission
  const weights = priorityOf(priority).weights

  // The scan starts at the beginning of the current day and does not move while time plays within it.
  const start = Math.floor(t / DAY) * DAY

  // One pass over the year: what the sky does at every step. Windows are then sums over this.
  const sky = useMemo(() => {
    const [lo, hi] = getEphemeris().range
    const end = Math.min(start + (SPAN_DAYS + 31) * DAY, hi)
    const n = Math.max(0, Math.floor((end - Math.max(start, lo)) / (STEP_H * HOUR)))
    const first = Math.max(start, lo)
    const solar = new Float32Array(n + 1)
    const dte = new Float32Array(n + 1)
    const both = new Float32Array(n + 1)
    const lit = new Uint8Array(n)
    for (let k = 0; k < n; k++) {
      const v = topo(site, first + k * STEP_H * HOUR)
      const f = v.sun.visibleFraction
      lit[k] = f > 0 ? 1 : 0
      // Prefix sums: sum over [a, b) is prefix[b] - prefix[a].
      solar[k + 1] = solar[k] + f
      dte[k + 1] = dte[k] + (v.earth.visible ? 1 : 0)
      both[k + 1] = both[k] + (f > 0 && v.earth.visible ? 1 : 0)
    }
    return { first, n, solar, dte, both, lit }
  }, [site, start])

  const model = useMemo(() => {
    const len = Math.round((days * 24) / STEP_H)
    const count = Math.max(0, Math.min(sky.n - len, Math.round((SPAN_DAYS * 24) / STEP_H)))
    const score = new Float32Array(count)
    const at = (k: number): Pick => {
      const solar = (100 * (sky.solar[k + len] - sky.solar[k])) / len
      const dte = (100 * (sky.dte[k + len] - sky.dte[k])) / len
      const both = (100 * (sky.both[k + len] - sky.both[k])) / len
      return {
        t: sky.first + k * STEP_H * HOUR,
        score: weights[0] * solar + weights[1] * dte + weights[2] * both,
        solar,
        dte,
        both,
        lit: sky.lit[k] === 1,
      }
    }
    for (let k = 0; k < count; k++) score[k] = at(k).score

    // Best landing times: sunlit on arrival, highest score, at least a week apart so they are different chances.
    const order = Array.from({ length: count }, (_, k) => k)
      .filter((k) => sky.lit[k] === 1)
      .sort((a, b) => score[b] - score[a])
    const picked: number[] = []
    const gap = (7 * 24) / STEP_H
    for (const k of order) {
      if (picked.every((p) => Math.abs(p - k) >= gap)) picked.push(k)
      if (picked.length === 5) break
    }
    return { count, score, at, picks: picked.map(at) }
  }, [sky, days, weights])

  const W = Math.max(width, 240)
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const spanMs = Math.max(1, model.count * STEP_H * HOUR)
  const spanDays = spanMs / DAY
  const viewStart = sky.first + view[0] * spanMs
  const viewMs = Math.max(1, (view[1] - view[0]) * spanMs)
  const viewDays = viewMs / DAY
  const zoomed = view[0] > 0.0005 || view[1] < 0.9995
  const x = (time: number) => PAD.left + ((time - viewStart) / viewMs) * iw
  const y = (s: number) => PAD.top + (1 - s / 100) * ih
  const timeAtPx = (px: number) => viewStart + ((px - PAD.left) / iw) * viewMs
  const indexOf = (time: number) =>
    Math.min(model.count - 1, Math.max(0, Math.round((time - sky.first) / (STEP_H * HOUR))))

  /** Show `daysWide` days centred on `centre`, kept inside the year. */
  const showPeriod = (daysWide: number, centre: number) => {
    const w = Math.min(1, Math.max(MIN_VIEW_DAYS, daysWide) / spanDays)
    const c = (centre - sky.first) / spanMs
    const a = Math.min(Math.max(c - w / 2, 0), 1 - w)
    setView([a, a + w])
  }
  const shift = (dir: 1 | -1) => {
    const w = view[1] - view[0]
    const a = Math.min(Math.max(view[0] + dir * w * 0.5, 0), 1 - w)
    setView([a, a + w])
  }
  const inSpan = t >= sky.first && t <= sky.first + spanMs
  const focus = inSpan ? t : viewStart + viewMs / 2

  const area = useMemo(() => {
    if (model.count === 0) return ''
    const k0 = Math.max(0, indexOf(viewStart) - 1)
    const k1 = Math.min(model.count - 1, indexOf(viewStart + viewMs) + 1)
    // One point per pixel column is plenty.
    const stride = Math.max(1, Math.floor((k1 - k0) / Math.max(1, iw)))
    let d = `M${x(sky.first + k0 * STEP_H * HOUR).toFixed(1)} ${y(0)}`
    let lastK = k0
    for (let k = k0; k <= k1; k += stride) {
      d += `L${x(sky.first + k * STEP_H * HOUR).toFixed(1)} ${y(model.score[k]).toFixed(1)}`
      lastK = k
    }
    return `${d}L${x(sky.first + lastK * STEP_H * HOUR).toFixed(1)} ${y(0)}Z`
  }, [model, iw, view]) // eslint-disable-line react-hooks/exhaustive-deps

  // Date labels suited to how much time is on screen.
  const ticks: { t: number; label: string }[] = []
  if (viewDays > 150) {
    const d = new Date(viewStart)
    let m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
    while (m < viewStart + viewMs) {
      const md = new Date(m)
      ticks.push({ t: m, label: md.getUTCMonth() === 0 ? String(md.getUTCFullYear()) : MONTHS[md.getUTCMonth()] })
      m = Date.UTC(md.getUTCFullYear(), md.getUTCMonth() + 1, 1)
    }
  } else {
    const every = viewDays > 70 ? 14 : viewDays > 35 ? 7 : viewDays > 16 ? 3 : viewDays > 8 ? 2 : 1
    for (let d = Math.ceil(viewStart / DAY) * DAY; d < viewStart + viewMs; d += DAY) {
      if (Math.round((d - sky.first) / DAY) % every === 0) ticks.push({ t: d, label: dateShortUTC(d) })
    }
  }

  const pxOf = (e: React.PointerEvent<SVGSVGElement>) => e.clientX - e.currentTarget.getBoundingClientRect().left
  const inChart = (px: number) => px >= PAD.left && px <= PAD.left + iw
  const hovered = hover !== null && model.count > 0 ? model.at(hover) : null
  const best = model.picks[0]
  const small = (active: boolean) => `btn min-h-8! text-xs! ${active ? 'btn-primary' : ''}`

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <MissionControls mission={mission} onChange={onMission} />
      </div>

      {model.count === 0 ? (
        <p className="mt-4 text-sm text-muted">The ephemeris does not reach a year beyond this date. Pick an earlier date.</p>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed">
            {best ? (
              <>
                The best time to land here in the next 12 months is{' '}
                <strong className="num font-semibold">
                  {dateUTC(best.t)}, {timeUTC(best.t)} UTC
                </strong>
                : over the following {days} days, sunlight worth {best.solar.toFixed(0)}% of full power and Earth in view{' '}
                {best.dte.toFixed(0)}% of the time.
              </>
            ) : (
              'This point gets no sunlight at any time in the next 12 months, so there is no good landing date.'
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
            <div className="flex items-center gap-1.5" role="group" aria-label="Period shown on the chart">
              <span>Show</span>
              {PERIODS.map((p) => (
                <button
                  key={p.days}
                  className={small(Math.abs(viewDays - Math.min(p.days, spanDays)) < 1.5)}
                  onClick={() => showPeriod(p.days, focus)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5" role="group" aria-label="Move along the year">
              <button className={small(false)} onClick={() => shift(-1)} disabled={view[0] <= 0.0005}>
                Earlier
              </button>
              <button className={small(false)} onClick={() => shift(1)} disabled={view[1] >= 0.9995}>
                Later
              </button>
            </div>
            <span className="num text-ink">
              {dateUTC(viewStart)} to {dateUTC(viewStart + viewMs)}
            </span>
          </div>

          <div ref={ref} data-tour="dates" className="mt-2">
            <svg
              width={W}
              height={H}
              role="img"
              aria-label={`Landing score at ${site.name} for each possible landing date from ${dateUTC(viewStart)} to ${dateUTC(viewStart + viewMs)}`}
              className="cursor-crosshair touch-none select-none"
              onPointerDown={(e) => {
                const px = pxOf(e)
                if (!inChart(px)) return
                e.currentTarget.setPointerCapture(e.pointerId)
                dragFrom.current = px
              }}
              onPointerMove={(e) => {
                const px = Math.min(Math.max(pxOf(e), PAD.left), PAD.left + iw)
                setHover(indexOf(timeAtPx(px)))
                if (dragFrom.current !== null && Math.abs(px - dragFrom.current) > 4) setBrush([dragFrom.current, px])
              }}
              onPointerUp={(e) => {
                const from = dragFrom.current
                dragFrom.current = null
                if (from === null) return
                const px = Math.min(Math.max(pxOf(e), PAD.left), PAD.left + iw)
                if (brush && Math.abs(px - from) > 4) {
                  // Dragged: zoom to the swept period.
                  const a = timeAtPx(Math.min(from, px))
                  const b = timeAtPx(Math.max(from, px))
                  showPeriod((b - a) / DAY, (a + b) / 2)
                } else {
                  // Clicked: go to that date.
                  onChange(model.at(indexOf(timeAtPx(px))).t)
                }
                setBrush(null)
              }}
              onPointerLeave={() => {
                if (dragFrom.current === null) setHover(null)
              }}
            >
              <defs>
                <clipPath id={clipId}>
                  <rect x={PAD.left} y={0} width={iw} height={H - PAD.bottom + 1} />
                </clipPath>
              </defs>
              {[0, 50, 100].map((s) => (
                <g key={s}>
                  <line x1={PAD.left} x2={PAD.left + iw} y1={y(s)} y2={y(s)} stroke="#2d313a" />
                  <text x={PAD.left - 6} y={y(s) + 4} textAnchor="end" fontSize="11" fill="#969aa3" className="num">
                    {s}
                  </text>
                </g>
              ))}
              {ticks.map((m) => (
                <g key={m.t}>
                  <line x1={x(m.t)} x2={x(m.t)} y1={y(0)} y2={y(0) + 4} stroke="#454a56" />
                  <text x={x(m.t)} y={H - 6} fontSize="11" fill="#969aa3" textAnchor="middle">
                    {m.label}
                  </text>
                </g>
              ))}
              <g clipPath={`url(#${clipId})`}>
                <path d={area} fill="#eceae4" opacity="0.2" />
                <path d={area} fill="none" stroke="#eceae4" strokeWidth="1.25" />
                {model.picks.map((p, i) => (
                  <g key={p.t}>
                    <line x1={x(p.t)} x2={x(p.t)} y1={y(p.score)} y2={y(0)} stroke="#58a6e8" strokeWidth="1" />
                    <circle cx={x(p.t)} cy={Math.max(y(p.score), 9)} r="8" fill="#58a6e8" />
                    <text x={x(p.t)} y={Math.max(y(p.score), 9) + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#000">
                      {i + 1}
                    </text>
                  </g>
                ))}
                {inSpan && <line x1={x(t)} x2={x(t)} y1={PAD.top} y2={y(0)} stroke="#fff" strokeWidth="1.5" />}
                {hovered && !brush && (
                  <line x1={x(hovered.t)} x2={x(hovered.t)} y1={PAD.top} y2={y(0)} stroke="#969aa3" strokeDasharray="3 3" />
                )}
                {brush && (
                  <rect
                    x={Math.min(brush[0], brush[1])}
                    y={PAD.top}
                    width={Math.abs(brush[1] - brush[0])}
                    height={ih}
                    fill="#58a6e8"
                    opacity="0.22"
                    stroke="#58a6e8"
                  />
                )}
              </g>
            </svg>
            <p className="num mt-1 min-h-5 text-xs text-muted" aria-live="polite">
              {brush
                ? `Zoom to ${dateUTC(timeAtPx(Math.min(brush[0], brush[1])))} to ${dateUTC(timeAtPx(Math.max(brush[0], brush[1])))}`
                : hovered
                  ? `Landing ${dateUTC(hovered.t)}, ${timeUTC(hovered.t)} UTC: score ${hovered.score.toFixed(0)}, sunlight ${hovered.solar.toFixed(0)}%, Earth in view ${hovered.dte.toFixed(0)}%${hovered.lit ? '' : ', dark on arrival'}. Click to go there.`
                  : `Drag across the chart to zoom into a period${zoomed ? ', or press "12 months" to see the whole year again' : ''}. Click a date to go there. The white line is the date showing now.`}
            </p>
          </div>

          {model.picks.length > 0 && (
            <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {model.picks.map((p, i) => (
                <li key={p.t} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-raised p-3">
                  <div>
                    <div className="num text-sm">
                      <span className="mr-2 inline-grid h-5 w-5 place-items-center rounded-full bg-earth text-xs font-semibold text-black">
                        {i + 1}
                      </span>
                      {dateShortUTC(p.t)} {new Date(p.t).getUTCFullYear()}
                    </div>
                    <div className="num mt-1 text-xs text-muted">
                      Score {p.score.toFixed(0)}: sun {p.solar.toFixed(0)}%, Earth {p.dte.toFixed(0)}%
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button className="btn" onClick={() => showPeriod(30, p.t)} aria-label={`Zoom the chart to ${dateUTC(p.t)}`}>
                      Zoom
                    </button>
                    <button className="btn" onClick={() => onChange(p.t)} aria-label={`Go to ${dateUTC(p.t)}`}>
                      Go
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted">
            Score out of 100: {priorityOf(priority).blurb}, over the {days} days after landing. The numbered dates are the
            highest-scoring landing times in the whole 12 months that are sunlit on arrival and at least a week apart.
            Like every score here, this counts sunlight and Earth contact only.
          </p>
        </>
      )}
    </div>
  )
}
