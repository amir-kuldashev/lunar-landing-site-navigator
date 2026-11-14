import { useMemo } from 'react'
import { summary, topo, type Site } from '../core'
import { dateUTC, deg, duration, timeUTC } from '../lib/format'

/** Pinned site + date scenarios side by side, so a schedule slip or a site change can be judged at a glance. */

export interface Scenario {
  key: string
  site: Site
  t: number
}

interface Row extends Scenario {
  sunEl: number
  lit: number
  dte: number
  both: number
  night: number
}

export default function Compare({
  scenarios,
  days,
  onLoad,
  onRemove,
}: {
  scenarios: Scenario[]
  days: number
  onLoad: (s: Scenario) => void
  onRemove: (key: string) => void
}) {
  const rows: Row[] = useMemo(
    () =>
      scenarios.map((s) => {
        const sum = summary(s.site, s.t, days)
        return {
          ...s,
          sunEl: topo(s.site, s.t).sun.el,
          lit: sum.litPct,
          dte: sum.dtePct,
          both: sum.bothPct,
          night: sum.longestNight_h,
        }
      }),
    [scenarios, days],
  )

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing pinned yet. Choose a site and a date, then use "Pin this scenario" to keep it here and compare it
        with the next one.
      </p>
    )
  }

  const best = {
    lit: Math.max(...rows.map((r) => r.lit)),
    dte: Math.max(...rows.map((r) => r.dte)),
    both: Math.max(...rows.map((r) => r.both)),
    night: Math.min(...rows.map((r) => r.night)),
  }
  const mark = (isBest: boolean) => (isBest && rows.length > 1 ? 'font-semibold text-ink' : 'text-muted')

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2 pr-4 font-normal">Site</th>
            <th className="py-2 pr-4 font-normal">Arrival (UTC)</th>
            <th className="py-2 pr-4 text-right font-normal">Sun at arrival</th>
            <th className="py-2 pr-4 text-right font-normal">Sunlit, {days} d</th>
            <th className="py-2 pr-4 text-right font-normal">Earth in view</th>
            <th className="py-2 pr-4 text-right font-normal">Both</th>
            <th className="py-2 pr-4 text-right font-normal">Longest night</th>
            <th className="py-2 font-normal">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line/60">
              <td className="py-2.5 pr-4">{r.site.name}</td>
              <td className="num py-2.5 pr-4 text-muted">
                {dateUTC(r.t)}, {timeUTC(r.t)}
              </td>
              <td className="num py-2.5 pr-4 text-right text-sun">{deg(r.sunEl)}</td>
              <td className={`num py-2.5 pr-4 text-right ${mark(r.lit === best.lit)}`}>{r.lit.toFixed(0)}%</td>
              <td className={`num py-2.5 pr-4 text-right ${mark(r.dte === best.dte)}`}>{r.dte.toFixed(0)}%</td>
              <td className={`num py-2.5 pr-4 text-right ${mark(r.both === best.both)}`}>{r.both.toFixed(0)}%</td>
              <td className={`num py-2.5 pr-4 text-right ${mark(r.night === best.night)}`}>
                {duration(r.night * 3600000)}
              </td>
              <td className="py-2.5 text-right whitespace-nowrap">
                <button className="btn mr-2" onClick={() => onLoad(r)}>
                  Open
                </button>
                <button className="btn" onClick={() => onRemove(r.key)} aria-label={`Remove ${r.site.name}`}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
