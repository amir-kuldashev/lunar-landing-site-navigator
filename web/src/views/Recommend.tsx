import { useMemo, useState } from 'react'
import { summary, topo, type HorizonProfile, type Site, type TerrainPatch } from '../core'
import { HOUR, dateUTC, duration } from '../lib/format'
import { priorityOf, type Mission } from '../lib/scoring'
import MissionControls from './MissionControls'
import PolarMap from './PolarMap'

/**
 * "Where should we land on this date?" Scores every site in the catalog for a mission starting at the
 * chosen time and ranks them. The score uses sunlight and Earth contact only, and says so.
 */

interface Props {
  sites: Site[]
  t: number
  current: Site
  onOpen: (id: string) => void
  /** Open an arbitrary point (from the south-pole map) with its own terrain skyline. */
  onPickPoint: (lat: number, lon: number, horizon: HorizonProfile, terrain?: TerrainPatch) => void
  mission: Mission
  onMission: (m: Mission) => void
  /** Which ranking is showing: the named sites, or the whole south pole on a map. */
  view: RankView
  onView: (v: RankView) => void
}

export type RankView = 'list' | 'map'

interface Row {
  site: Site
  score: number
  solar: number
  dte: number
  both: number
  night_h: number
  litAtArrival: boolean
  earthAtArrival: boolean
}

export default function Recommend({ sites, t, current, onOpen, onPickPoint, mission, onMission, view, onView }: Props) {
  const { days, priority } = mission
  const setView = onView
  const currentId = current.id
  const [polarOnly, setPolarOnly] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Round to the hour so playback does not re-rank on every frame.
  const tHour = Math.round(t / HOUR) * HOUR

  const measured = useMemo(
    () =>
      sites.map((site) => {
        const s = summary(site, tHour, days, { stepMin: 60 })
        const now = topo(site, tHour)
        return {
          site,
          solar: s.meanSolarPct,
          dte: s.dtePct,
          both: s.bothPct,
          night_h: s.longestNight_h,
          litAtArrival: now.sun.visibleFraction > 0,
          earthAtArrival: now.earth.visible,
        }
      }),
    [sites, tHour, days],
  )

  const rows: Row[] = useMemo(() => {
    const [wSolar, wDte, wBoth] = priorityOf(priority).weights
    return measured
      .filter((r) => !polarOnly || r.site.lat <= -80)
      .map((r) => ({ ...r, score: wSolar * r.solar + wDte * r.dte + wBoth * r.both }))
      .sort((a, b) => Number(b.litAtArrival) - Number(a.litAtArrival) || b.score - a.score)
  }, [measured, priority, polarOnly])

  const best = rows[0]
  const shown = showAll ? rows : rows.slice(0, 5)
  const toggle = (active: boolean) => `btn min-h-8! text-xs! ${active ? 'btn-primary' : ''}`

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
        <div className="flex items-center gap-1.5" role="group" aria-label="What to rank">
          <button className={toggle(view === 'list')} aria-pressed={view === 'list'} onClick={() => setView('list')}>
            Named sites
          </button>
          <button className={toggle(view === 'map')} aria-pressed={view === 'map'} onClick={() => setView('map')}>
            Whole south pole
          </button>
        </div>
        <MissionControls mission={mission} onChange={onMission} />
        {view === 'list' && (
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="accent-(--color-ink)" checked={polarOnly} onChange={(e) => setPolarOnly(e.target.checked)} />
            South pole sites only
          </label>
        )}
      </div>

      {view === 'map' && (
        <>
          <PolarMap
            sites={sites}
            t={t}
            days={days}
            weights={priorityOf(priority).weights}
            current={current}
            onPick={onPickPoint}
          />
          <p className="mt-3 max-w-3xl text-xs leading-relaxed text-muted">
            Score out of 100: {priorityOf(priority).blurb}, over the mission length.
          </p>
        </>
      )}

      {view === 'list' && (
        <>
      {best ? (
        <p className="mt-4 text-sm leading-relaxed">
          For a {days}-day mission landing on <span className="num">{dateUTC(tHour)}</span>, the best site in this list is{' '}
          <strong className="font-semibold">{best.site.name}</strong>: sunlight worth {best.solar.toFixed(0)}% of full power,
          Earth in view {best.dte.toFixed(0)}% of the time, and both together {best.both.toFixed(0)}%.
          {!best.litAtArrival && ' Every site in this list is dark at that moment, so none offers a sunlit landing.'}
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">No sites match. Untick "South pole sites only" to see the full list.</p>
      )}

      {rows.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 pr-3 font-normal">Rank</th>
                <th className="py-2 pr-4 font-normal">Site</th>
                <th className="py-2 pr-4 font-normal">On arrival</th>
                <th className="py-2 pr-4 text-right font-normal">Sunlight</th>
                <th className="py-2 pr-4 text-right font-normal">Earth in view</th>
                <th className="py-2 pr-4 text-right font-normal">Both</th>
                <th className="py-2 pr-4 text-right font-normal">Longest night</th>
                <th className="py-2 pr-4 text-right font-normal">Score</th>
                <th className="py-2 font-normal">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.site.id} className="border-b border-line/60">
                  <td className="num py-2.5 pr-3 text-muted">{i + 1}</td>
                  <td className="py-2.5 pr-4">
                    {r.site.name}
                    {r.site.verified === false && <span className="ml-2 text-xs text-muted">unverified position</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-xs">
                    <span className={r.litAtArrival ? 'text-sun' : 'text-warn'}>{r.litAtArrival ? 'Sunlit' : 'Dark'}</span>
                    <span className="text-muted">, </span>
                    <span className={r.earthAtArrival ? 'text-earth' : 'text-warn'}>
                      {r.earthAtArrival ? 'Earth in view' : 'no Earth link'}
                    </span>
                  </td>
                  <td className="num py-2.5 pr-4 text-right">{r.solar.toFixed(0)}%</td>
                  <td className="num py-2.5 pr-4 text-right">{r.dte.toFixed(0)}%</td>
                  <td className="num py-2.5 pr-4 text-right">{r.both.toFixed(0)}%</td>
                  <td className="num py-2.5 pr-4 text-right text-muted">{duration(r.night_h * HOUR)}</td>
                  <td className="num py-2.5 pr-4 text-right font-semibold">{r.score.toFixed(0)}</td>
                  <td className="py-2.5 text-right">
                    <button className="btn" onClick={() => onOpen(r.site.id)} disabled={r.site.id === currentId}>
                      {r.site.id === currentId ? 'Showing' : 'Open'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-3xl text-xs leading-relaxed text-muted">
          Score out of 100: {priorityOf(priority).blurb}, over the mission length. "Sunlight" is the
          average share of the Sun's disk above the skyline. Sites that are sunlit on arrival rank above sites that are
          dark, since most landers need light to touch down. The ranking covers only the sites in this list and only
          sunlight and Earth contact; it does not weigh science value, terrain safety or how reachable a site is.
        </p>
        {rows.length > 5 && (
          <button className="btn" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'Show top 5' : `Show all ${rows.length}`}
          </button>
        )}
      </div>
        </>
      )}
    </div>
  )
}
