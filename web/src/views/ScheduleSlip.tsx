import { useMemo, useState } from 'react'
import { summary, type Site } from '../core'
import { DAY, HOUR, dateUTC, duration } from '../lib/format'

/**
 * "What if the landing slips?" Holds a planned date, lets the visitor slide the landing
 * earlier or later, and shows how the 30-day sunlight and Earth-contact figures change.
 * The slider drives the app's single clock, so the Moon, sky and timeline follow it.
 *
 * Based on the schedule-slip simulator by Winner-121 (PR #1).
 */

interface Props {
  site: Site
  t: number
  days: number
  onChange: (t: number) => void
}

const RANGE = 45
const PRESETS = [-14, -7, 7, 14, 21, 28]

function Delta({
  label,
  before,
  after,
  format,
  higherIsBetter,
}: {
  label: string
  before: number
  after: number
  format: (v: number) => string
  higherIsBetter: boolean
}) {
  const change = after - before
  const flat = Math.abs(change) < 0.05
  const better = higherIsBetter ? change > 0 : change < 0
  return (
    <div className="rounded-lg border border-line bg-raised p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-1 text-base">
        {format(before)} <span className="text-muted">to</span> {format(after)}
      </div>
      <div className={`num mt-1 text-xs ${flat ? 'text-muted' : better ? 'text-earth' : 'text-warn'}`}>
        {flat ? 'No change' : `${better ? 'Better' : 'Worse'} by ${format(Math.abs(change))}`}
      </div>
    </div>
  )
}

export default function ScheduleSlip({ site, t, days, onChange }: Props) {
  const [planned, setPlanned] = useState(t)
  const slip = Math.round((t - planned) / DAY)
  const inRange = Math.abs(slip) <= RANGE

  // Summaries are heavy enough to skip recomputing on every animation frame.
  const tHour = Math.round(t / HOUR) * HOUR
  const before = useMemo(() => summary(site, planned, days), [site, planned, days])
  const after = useMemo(() => summary(site, tHour, days), [site, tHour, days])

  const pct = (v: number) => `${v.toFixed(0)}%`
  const hours = (v: number) => duration(v * HOUR)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Planned landing <span className="num text-ink">{dateUTC(planned)}</span>
          {slip !== 0 && (
            <>
              , now looking at <span className="num text-ink">{dateUTC(t)}</span> (
              {Math.abs(slip)} {Math.abs(slip) === 1 ? 'day' : 'days'} {slip > 0 ? 'later' : 'earlier'})
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => setPlanned(t)} disabled={slip === 0}>
            Set this date as the plan
          </button>
          <button className="btn" onClick={() => onChange(planned)} disabled={slip === 0}>
            Back to the plan
          </button>
        </div>
      </div>

      <div className="mt-4">
        <input
          type="range"
          className="w-full accent-(--color-ink)"
          min={-RANGE}
          max={RANGE}
          step={1}
          value={Math.max(-RANGE, Math.min(RANGE, slip))}
          onChange={(e) => onChange(planned + Number(e.target.value) * DAY)}
          aria-label="Days of schedule slip from the planned landing"
          aria-valuetext={`${slip} days`}
        />
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>{RANGE} days earlier</span>
          <span>On plan</span>
          <span>{RANGE} days later</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((d) => (
            <button
              key={d}
              className={`btn ${slip === d ? 'btn-primary' : ''}`}
              onClick={() => onChange(planned + d * DAY)}
              aria-pressed={slip === d}
            >
              {d > 0 ? `${d} days later` : `${-d} days earlier`}
            </button>
          ))}
        </div>
      </div>

      {!inRange && (
        <p className="mt-3 text-xs text-muted">
          The date is more than {RANGE} days from the plan, beyond the slider. The comparison below still applies.
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Delta label={`Sunlit, ${days} days`} before={before.litPct} after={after.litPct} format={pct} higherIsBetter />
        <Delta label="Earth in view" before={before.dtePct} after={after.dtePct} format={pct} higherIsBetter />
        <Delta label="Sunlight and Earth together" before={before.bothPct} after={after.bothPct} format={pct} higherIsBetter />
        <Delta
          label="Longest night"
          before={before.longestNight_h}
          after={after.longestNight_h}
          format={hours}
          higherIsBetter={false}
        />
      </div>
    </div>
  )
}
