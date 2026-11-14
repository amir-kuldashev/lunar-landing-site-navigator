import { useEffect, useMemo, useState } from 'react'
import { events, getEphemeris, loadEphemeris, summary, topo, type Site } from './core'

/**
 * Placeholder shell: proves the core functions work end to end.
 * The real views (Panorama, Timeline, Metrics, Globe, CompareBoard, SitePicker) go in src/views/
 * and replace the sections below. See docs/PLAN.md.
 */

const DAY = 86400000

function fmtDuration(ms: number | null): string {
  if (ms === null) return 'none in the next 30 days'
  const h = ms / 3600000
  return h >= 48 ? `${(h / 24).toFixed(1)} days` : `${h.toFixed(1)} h`
}

function toLocalInput(t: number): string {
  return new Date(t).toISOString().slice(0, 16)
}

export default function App() {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState('')
  const [t, setT] = useState(() => Date.UTC(2027, 0, 1))
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([
      loadEphemeris(),
      fetch(`${import.meta.env.BASE_URL}data/sites.json`).then((r) => r.json() as Promise<Site[]>),
    ]).then(([, list]) => {
      setSites(list)
      setSiteId(list[0]?.id ?? '')
      setReady(true)
    })
  }, [])

  const site = sites.find((s) => s.id === siteId)
  const result = useMemo(() => {
    if (!ready || !site) return null
    return { now: topo(site, t), ev: events(site, t, t + 30 * DAY), sum: summary(site, t, 30) }
  }, [ready, site, t])

  if (!result || !site) return <main className="p-6">Loading…</main>
  const { now, ev, sum } = result

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Lunar Landing Site Navigator</h1>
        {getEphemeris().approximate && (
          <p className="mt-2 rounded bg-amber-900/50 px-3 py-2 text-sm text-amber-200">
            Using the approximate mock ephemeris. Run <code>uv run pipeline/build_ephem.py</code> for real numbers.
          </p>
        )}
      </header>

      <section className="flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Site
          <select className="rounded bg-slate-800 px-2 py-1" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Date and time (UTC)
          <input
            className="rounded bg-slate-800 px-2 py-1"
            type="datetime-local"
            value={toLocalInput(t)}
            onChange={(e) => e.target.value && setT(Date.parse(`${e.target.value}:00Z`))}
          />
        </label>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-900 p-4">
          <h2 className="mb-2 font-medium text-amber-300">Sun</h2>
          <p>Elevation {now.sun.el.toFixed(2)}°, azimuth {now.sun.az.toFixed(1)}°</p>
          <p>Disk visible: {(now.sun.visibleFraction * 100).toFixed(0)}%</p>
          <p>
            {now.sun.visibleFraction > 0
              ? `Sunset in ${fmtDuration(ev.nextSunset && ev.nextSunset - t)}`
              : `Sunrise in ${fmtDuration(ev.nextSunrise && ev.nextSunrise - t)}`}
          </p>
        </div>
        <div className="rounded-lg bg-slate-900 p-4">
          <h2 className="mb-2 font-medium text-sky-300">Earth</h2>
          <p>Elevation {now.earth.el.toFixed(2)}°, azimuth {now.earth.az.toFixed(1)}°</p>
          <p>Direct-to-Earth link: {now.earth.visible ? 'available' : 'blocked'}</p>
          <p>
            {now.earth.visible
              ? `Earthset in ${fmtDuration(ev.nextEarthset && ev.nextEarthset - t)}`
              : `Earthrise in ${fmtDuration(ev.nextEarthrise && ev.nextEarthrise - t)}`}
          </p>
        </div>
      </section>

      <section className="rounded-lg bg-slate-900 p-4 text-sm">
        <h2 className="mb-2 text-base font-medium">Next 30 days</h2>
        <p>
          Sunlit {sum.litPct.toFixed(0)}% of the time · Earth in view {sum.dtePct.toFixed(0)}% · both {sum.bothPct.toFixed(0)}%
        </p>
        <p>
          Longest night {fmtDuration(sum.longestNight_h * 3600000)} · Sun elevation {sum.minSunEl.toFixed(1)}° to{' '}
          {sum.maxSunEl.toFixed(1)}°
        </p>
        <p className="mt-2 text-slate-400">
          Horizon: {site.horizon ? 'LOLA terrain' : 'smooth sphere (no terrain yet)'} · site {site.lat.toFixed(3)}°,{' '}
          {site.lon.toFixed(3)}°E
        </p>
      </section>
    </main>
  )
}
