import { useMemo, useState } from 'react'
import { getEphemeris, topo, type Site } from '../core'
import { DAY, HOUR, dateShortUTC, dateUTC, timeUTC } from '../lib/format'
import { priorityOf, type Mission } from '../lib/scoring'
import { useSize } from '../lib/useSize'
import MissionControls from './MissionControls'

/**
 * "When should we land here?" Scores every possible landing time at one site over the coming year,
 * for the chosen mission length and priority, and picks out the best ones. This is the question a
 * mission faces when its schedule slips and the site is fixed.
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
const PAD = { left: 36, right: 10, top: 10, bottom: 24 }
const H = 170
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
  const [hover, setHover] = useState<number | null>(null)
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
    return { count, score, at, picks: picked.map(at), anyLit: order.length > 0 }
  }, [sky, days, weights])

  const W = Math.max(width, 240)
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const spanMs = Math.max(1, model.count * STEP_H * HOUR)
  const x = (time: number) => PAD.left + ((time - sky.first) / spanMs) * iw
  const y = (s: number) => PAD.top + (1 - s / 100) * ih

  const area = useMemo(() => {
    if (model.count === 0) return ''
    let d = `M${PAD.left} ${y(0)}`
    // One point per pixel column is plenty.
    const stride = Math.max(1, Math.floor(model.count / Math.max(1, iw)))
    for (let k = 0; k < model.count; k += stride) d += `L${x(sky.first + k * STEP_H * HOUR).toFixed(1)} ${y(model.score[k]).toFixed(1)}`
    return `${d}L${PAD.left + iw} ${y(0)}Z`
  }, [model, iw]) // eslint-disable-line react-hooks/exhaustive-deps

  const months: { t: number; label: string }[] = []
  {
    const d = new Date(sky.first)
    let m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
    while (m < sky.first + spanMs) {
      const md = new Date(m)
      months.push({ t: m, label: md.getUTCMonth() === 0 ? String(md.getUTCFullYear()) : MONTHS[md.getUTCMonth()] })
      m = Date.UTC(md.getUTCFullYear(), md.getUTCMonth() + 1, 1)
    }
  }

  const indexAt = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect()
    const f = (clientX - r.left - PAD.left) / iw
    return f < 0 || f > 1 || model.count === 0 ? null : Math.min(model.count - 1, Math.round(f * (model.count - 1)))
  }
  const hovered = hover !== null ? model.at(hover) : null
  const best = model.picks[0]

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

          <div ref={ref} className="mt-3">
            <svg
              width={W}
              height={H}
              role="img"
              aria-label={`Landing score at ${site.name} for each possible landing date over the next 12 months`}
              className="cursor-pointer"
              onPointerMove={(e) => setHover(indexAt(e.clientX, e.currentTarget))}
              onPointerLeave={() => setHover(null)}
              onClick={(e) => {
                const k = indexAt(e.clientX, e.currentTarget)
                if (k !== null) onChange(model.at(k).t)
              }}
            >
              {[0, 50, 100].map((s) => (
                <g key={s}>
                  <line x1={PAD.left} x2={PAD.left + iw} y1={y(s)} y2={y(s)} stroke="#2d313a" />
                  <text x={PAD.left - 6} y={y(s) + 4} textAnchor="end" fontSize="11" fill="#969aa3" className="num">
                    {s}
                  </text>
                </g>
              ))}
              <path d={area} fill="#eceae4" opacity="0.2" />
              <path d={area} fill="none" stroke="#eceae4" strokeWidth="1.25" />
              {months.map((m) => (
                <text key={m.t} x={x(m.t)} y={H - 6} fontSize="11" fill="#969aa3">
                  {m.label}
                </text>
              ))}
              {model.picks.map((p, i) => (
                <g key={p.t}>
                  <line x1={x(p.t)} x2={x(p.t)} y1={y(p.score)} y2={y(0)} stroke="#58a6e8" strokeWidth="1" />
                  <circle cx={x(p.t)} cy={y(p.score)} r="8" fill="#58a6e8" />
                  <text x={x(p.t)} y={y(p.score) + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#000">
                    {i + 1}
                  </text>
                </g>
              ))}
              {t >= sky.first && t <= sky.first + spanMs && (
                <line x1={x(t)} x2={x(t)} y1={PAD.top} y2={y(0)} stroke="#fff" strokeWidth="1.5" />
              )}
              {hovered && <line x1={x(hovered.t)} x2={x(hovered.t)} y1={PAD.top} y2={y(0)} stroke="#969aa3" strokeDasharray="3 3" />}
            </svg>
            <p className="num mt-1 min-h-5 text-xs text-muted" aria-live="polite">
              {hovered
                ? `Landing ${dateUTC(hovered.t)}, ${timeUTC(hovered.t)} UTC: score ${hovered.score.toFixed(0)}, sunlight ${hovered.solar.toFixed(0)}%, Earth in view ${hovered.dte.toFixed(0)}%${hovered.lit ? '' : ', dark on arrival'}. Click to go there.`
                : 'Score for a mission landing on each date. The white line is the date showing now. Click the chart to go to a date.'}
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
                  <button className="btn" onClick={() => onChange(p.t)}>
                    Go
                  </button>
                </li>
              ))}
            </ol>
          )}

          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted">
            Score out of 100: {priorityOf(priority).blurb}, over the {days} days after landing. The numbered dates are the
            highest-scoring landing times that are sunlit on arrival and at least a week apart. Like every score here,
            this counts sunlight and Earth contact only.
          </p>
        </>
      )}
    </div>
  )
}
