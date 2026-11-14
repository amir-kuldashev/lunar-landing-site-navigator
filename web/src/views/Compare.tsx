import { useMemo } from 'react'
import { summary, topo, type Site } from '../core'
import { DAY, dateUTC, deg, duration, timeUTC } from '../lib/format'
import Panorama, { skyModel } from './Panorama'

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

  // One vertical scale for every sky, so heights can be compared by eye.
  const skies = useMemo(() => {
    const items = scenarios.map((s) => {
      const windowStart = Math.floor(s.t / DAY) * DAY
      return { ...s, windowStart, now: topo(s.site, s.t), fit: skyModel(s.site, windowStart, days) }
    })
    const range: [number, number] = [
      Math.min(...items.map((i) => i.fit.bottom)),
      Math.max(...items.map((i) => i.fit.top)),
    ]
    return { items, range }
  }, [scenarios, days])

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

      {skies.items.length >= 2 && (
        <div className="mt-6 min-w-[640px]">
          <h3 className="text-sm font-medium">The skies side by side</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted">
            Each strip is the sky from one pinned scenario, all on the same vertical scale ({skies.range[0]}° to{' '}
            {skies.range[1]}°) and each centred on Earth. The grey shape is the terrain, the dotted line is the Sun's
            path over {days} days and the blue line is Earth's. Where a path drops behind the terrain, that site loses
            sunlight or contact.
          </p>
          <div className="mt-3 space-y-4">
            {skies.items.map((s) => (
              <div key={s.key}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span>{s.site.name}</span>
                  <span className="num text-xs text-muted">
                    {dateUTC(s.t)}, {timeUTC(s.t)} UTC
                  </span>
                </div>
                <div className="mt-1 h-[150px]">
                  <Panorama site={s.site} now={s.now} windowStart={s.windowStart} days={days} range={skies.range} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
