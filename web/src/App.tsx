import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { events, getEphemeris, loadEphemeris, summary, topo, type HorizonProfile, type Site } from './core'
import { DAY, HOUR, dateUTC, fromInputValue, latLon, timeUTC, toInputValue } from './lib/format'
import Compare, { type Scenario } from './views/Compare'
import Panorama from './views/Panorama'
import Readouts from './views/Readouts'
import ScheduleSlip from './views/ScheduleSlip'
import Timeline from './views/Timeline'

// three.js is the heaviest part of the page; load it after the instruments are on screen.
const Globe = lazy(() => import('./views/Globe'))

const WINDOW_DAYS = 30
const SPEEDS = [
  { label: '1 hour per second', ms: HOUR },
  { label: '6 hours per second', ms: 6 * HOUR },
  { label: '1 day per second', ms: DAY },
]

const startOfDay = (t: number) => Math.floor(t / DAY) * DAY

const CUSTOM: Site = { id: 'custom', name: 'Custom point', lat: -85, lon: 30, alt_m: 0 }

export default function App() {
  const [catalog, setCatalog] = useState<Site[]>([])
  const [custom, setCustom] = useState<Site>(CUSTOM)
  const [siteId, setSiteId] = useState('')
  const [t, setT] = useState(() => Date.UTC(2027, 0, 1))
  const [windowStart, setWindowStart] = useState(() => Date.UTC(2027, 0, 1))
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [pinned, setPinned] = useState<Scenario[]>([])
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const base = `${import.meta.env.BASE_URL}data`
    Promise.all([loadEphemeris(), fetch(`${base}/sites.json`).then((r) => r.json() as Promise<Site[]>)])
      .then(async ([, list]) => {
        // Terrain horizons are optional per site; a missing file means a smooth-sphere horizon.
        const withHorizons = await Promise.all(
          list.map(async (s) => {
            try {
              const r = await fetch(`${base}/horizons/${s.id}.json`)
              if (!r.ok || !r.headers.get('content-type')?.includes('json')) return s
              return { ...s, horizon: (await r.json()) as HorizonProfile }
            } catch {
              return s
            }
          }),
        )
        setCatalog(withHorizons)
        setSiteId(withHorizons.find((s) => s.id === 'shackleton-ridge')?.id ?? withHorizons[0]?.id ?? 'custom')
        setReady(true)
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)))
  }, [])

  // Keep the 30-day window around the current time.
  const changeTime = useCallback((next: number) => {
    setT(next)
    setWindowStart((ws) => (next < ws || next > ws + WINDOW_DAYS * DAY ? startOfDay(next) : ws))
  }, [])

  // Play: advance simulated time on every animation frame.
  const last = useRef(0)
  useEffect(() => {
    if (!playing) return
    let raf = 0
    last.current = performance.now()
    const tick = (nowMs: number) => {
      const dt = Math.min(nowMs - last.current, 100)
      last.current = nowMs
      setT((prev) => {
        const next = prev + (dt / 1000) * SPEEDS[speed].ms
        setWindowStart((ws) => (next > ws + WINDOW_DAYS * DAY ? startOfDay(next) : ws))
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed])

  const sites = useMemo(() => [...catalog, custom], [catalog, custom])
  const site = sites.find((s) => s.id === siteId) ?? custom

  const windowData = useMemo(() => {
    if (!ready) return null
    return {
      // Events are searched 60 days out so countdowns still resolve near the end of the window.
      ev: events(site, windowStart, windowStart + 2 * WINDOW_DAYS * DAY),
      sum: summary(site, windowStart, WINDOW_DAYS),
    }
  }, [ready, site, windowStart])

  const now = useMemo(() => (ready ? topo(site, t) : null), [ready, site, t])

  if (loadError) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="display text-xl">The site list could not be loaded</h1>
        <p className="mt-2 text-sm text-muted">{loadError}. Reload the page to try again.</p>
      </main>
    )
  }
  if (!now || !windowData) {
    return <main className="grid h-full place-items-center text-sm text-muted">Loading the Moon…</main>
  }

  const range = getEphemeris().range
  const outOfRange = t < range[0] || t > range[1]
  const pickPoint = (lat: number, lon: number) => {
    setCustom({ ...CUSTOM, lat: Number(lat.toFixed(3)), lon: Number(lon.toFixed(3)) })
    setSiteId('custom')
  }
  const pin = () =>
    setPinned((p) =>
      [...p, { key: `${site.id}-${site.lat}-${site.lon}-${Math.round(t)}`, site: { ...site }, t }]
        .filter((s, i, a) => a.findIndex((x) => x.key === s.key) === i)
        .slice(-6),
    )
  const openScenario = (s: Scenario) => {
    if (s.site.id === 'custom') setCustom(s.site)
    setSiteId(s.site.id)
    setPlaying(false)
    changeTime(s.t)
  }

  return (
    <main className="mx-auto flex min-h-full max-w-[1500px] flex-col gap-4 px-4 pb-10 pt-4 sm:px-6">
      <header className="enter flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="display text-xl sm:text-2xl">Lunar Landing Site Navigator</h1>
          <p className="mt-0.5 text-sm text-muted">Sunlight and Earth contact at any landing site, on any date.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Landing site
            <select className="field min-w-56" value={site.id} onChange={(e) => setSiteId(e.target.value)}>
              {catalog.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="custom">Custom point…</option>
            </select>
          </label>
          {site.id === 'custom' && (
            <>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Latitude
                <input
                  className="field num w-24"
                  type="number"
                  min={-90}
                  max={90}
                  step={0.01}
                  value={custom.lat}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (Number.isFinite(v)) setCustom({ ...custom, lat: Math.min(90, Math.max(-90, v)) })
                  }}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                East longitude
                <input
                  className="field num w-24"
                  type="number"
                  min={-180}
                  max={360}
                  step={0.01}
                  value={custom.lon}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (Number.isFinite(v)) setCustom({ ...custom, lon: Math.min(360, Math.max(-180, v)) })
                  }}
                />
              </label>
            </>
          )}
          <label className="flex flex-col gap-1 text-xs text-muted">
            Date and time, UTC
            <input
              className="field num"
              type="datetime-local"
              value={toInputValue(t)}
              onChange={(e) => {
                if (!e.target.value) return
                setPlaying(false)
                changeTime(fromInputValue(e.target.value))
              }}
            />
          </label>
          <button className="btn btn-primary" onClick={pin}>
            Pin this scenario
          </button>
        </div>
      </header>

      {(getEphemeris().approximate || outOfRange) && (
        <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-ink" role="status">
          {getEphemeris().approximate
            ? 'Precise ephemeris data is not loaded, so these figures are rough estimates. Run the pipeline to build it.'
            : `The ephemeris covers ${dateUTC(range[0])} to ${dateUTC(range[1])}. Pick a date inside that range.`}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)]">
        <section
          className="enter-fade relative h-[46vh] min-h-[320px] overflow-hidden rounded-xl border border-line lg:h-auto lg:min-h-[440px]"
          aria-label="Moon"
        >
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-muted">Loading the 3D Moon…</div>}>
            <Globe sites={sites} site={site} now={now} onSelect={setSiteId} onPick={pickPoint} />
          </Suspense>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
            <div>
              <div className="display text-lg leading-tight">{site.name}</div>
              <div className="num mt-0.5 text-xs text-muted">{latLon(site.lat, site.lon)}</div>
            </div>
            <div className="text-right">
              <div className="num text-lg leading-tight">{timeUTC(t)} UTC</div>
              <div className="num mt-0.5 text-xs text-muted">{dateUTC(t)}</div>
            </div>
          </div>
          <p className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-xs text-muted">
            Drag to turn the Moon. Double-click the surface to place a custom point.
          </p>
        </section>

        <div className="enter" style={{ animationDelay: '120ms' }}>
          <Readouts
            now={now}
            events={windowData.ev}
            summary={windowData.sum}
            days={WINDOW_DAYS}
            windowEnd={windowStart + 2 * WINDOW_DAYS * DAY}
          />
        </div>
      </div>

      <section className="enter rounded-xl border border-line bg-panel p-4" style={{ animationDelay: '200ms' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">
            Sky from the site
            <span className="ml-2 font-normal text-muted">
              {site.horizon ? 'skyline from LOLA terrain, about 2 km resolution' : 'smooth horizon, no terrain data for this point'}
            </span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn" onClick={() => changeTime(t - DAY)} aria-label="Back one day">
              −1 day
            </button>
            <button className="btn" onClick={() => changeTime(t - HOUR)} aria-label="Back one hour">
              −1 h
            </button>
            <button className="btn btn-primary min-w-20" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <button className="btn" onClick={() => changeTime(t + HOUR)} aria-label="Forward one hour">
              +1 h
            </button>
            <button className="btn" onClick={() => changeTime(t + DAY)} aria-label="Forward one day">
              +1 day
            </button>
            <select
              className="field"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              aria-label="Playback speed"
            >
              {SPEEDS.map((s, i) => (
                <option key={s.label} value={i}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 h-[220px]">
          <Panorama site={site} now={now} windowStart={windowStart} days={WINDOW_DAYS} />
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <Timeline
            events={windowData.ev}
            windowStart={windowStart}
            days={WINDOW_DAYS}
            t={t}
            onChange={(next) => {
              setPlaying(false)
              setT(next)
            }}
          />
        </div>
      </section>

      <section className="enter rounded-xl border border-line bg-panel p-4" style={{ animationDelay: '240ms' }}>
        <h2 className="mb-3 text-sm font-medium">If the landing date slips</h2>
        <ScheduleSlip
          key={`${site.id}:${site.lat}:${site.lon}`}
          site={site}
          t={t}
          days={WINDOW_DAYS}
          onChange={(next) => {
            setPlaying(false)
            changeTime(next)
          }}
        />
      </section>

      <section className="enter rounded-xl border border-line bg-panel p-4" style={{ animationDelay: '280ms' }}>
        <h2 className="mb-3 text-sm font-medium">Compare scenarios</h2>
        <Compare
          scenarios={pinned}
          days={WINDOW_DAYS}
          onLoad={openScenario}
          onRemove={(key) => setPinned((p) => p.filter((s) => s.key !== key))}
        />
      </section>

      <footer className="text-xs text-muted">
        Sun and Earth positions from NASA NAIF SPICE (DE440), checked against JPL Horizons. Moon imagery: NASA
        Scientific Visualization Studio, LRO. A NASA Space Apps 2026 project.
      </footer>
    </main>
  )
}
