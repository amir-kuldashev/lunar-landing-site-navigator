import { useEffect, useMemo, useState } from 'react'
import {
  events,
  getEphemeris,
  loadEphemeris,
  summary,
  topo,
  type Site,
} from './core'
import { Metrics, Panorama, ScheduleSlip, Timeline } from './views'

const DAY_MS = 86400000

export default function App() {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState<string>('')
  const [customSite, setCustomSite] = useState<Site | null>(null)
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false)
  const [customLat, setCustomLat] = useState<number>(-89.45)
  const [customLon, setCustomLon] = useState<number>(222.69)
  const [customAlt, setCustomAlt] = useState<number>(0)

  // Current simulation time
  const [t, setT] = useState<number>(() => Date.UTC(2027, 0, 1, 0, 0, 0))
  // Anchor for the 30-day timeline ribbon window
  const [windowStart, setWindowStart] = useState<number>(() => Date.UTC(2027, 0, 1, 0, 0, 0))
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([
      loadEphemeris(),
      fetch(`${import.meta.env.BASE_URL}data/sites.json`).then((r) => r.json() as Promise<Site[]>),
    ])
      .then(([, list]) => {
        setSites(list)
        if (list.length > 0) {
          // Default to Shackleton connecting ridge if available, else first site
          const defaultSite = list.find((s) => s.id === 'shackleton-ridge') ?? list[0]
          setSiteId(defaultSite.id)
        }
        setReady(true)
      })
      .catch((err) => {
        console.error('Failed to load initial data:', err)
        setReady(true)
      })
  }, [])

  // Resolve active site
  const activeSite: Site = useMemo(() => {
    if (isCustomMode && customSite) {
      return customSite
    }
    const found = sites.find((s) => s.id === siteId)
    if (found) return found
    return {
      id: 'custom',
      name: `Custom (${customLat.toFixed(2)}°, ${customLon.toFixed(2)}°)`,
      lat: customLat,
      lon: customLon,
      alt_m: customAlt,
    }
  }, [isCustomMode, customSite, sites, siteId, customLat, customLon, customAlt])

  // Compute topo, events, and summary for active site
  const result = useMemo(() => {
    if (!ready || !activeSite) return null
    return {
      now: topo(activeSite, t),
      ev: events(activeSite, windowStart, windowStart + 30 * DAY_MS),
      sum: summary(activeSite, t, 30),
    }
  }, [ready, activeSite, t, windowStart])

  // Handle custom site submission
  const handleApplyCustomCoords = () => {
    const newCustom: Site = {
      id: `custom-${Date.now()}`,
      name: `Custom (${customLat >= 0 ? '+' : ''}${customLat.toFixed(2)}°, ${customLon >= 0 ? '+' : ''}${customLon.toFixed(2)}°E)`,
      lat: customLat,
      lon: customLon,
      alt_m: customAlt,
      category: 'User Custom',
    }
    setCustomSite(newCustom)
    setIsCustomMode(true)
  }

  if (!ready || !result) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
          <p className="font-mono text-sm text-slate-400">Initializing Lunar Ephemeris & Site Models…</p>
        </div>
      </main>
    )
  }

  const { now, ev, sum } = result
  const isApproxEphem = getEphemeris().approximate

  return (
    <main className="min-h-screen bg-[#0b0d12] text-slate-100 pb-12 selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30">
              <span className="text-xl">🌙</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Lunar Landing Site Navigator
                </h1>
                <span className="hidden sm:inline-block rounded-md bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/20">
                  NASA Space Apps 2026
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Horizon topography, solar illumination & direct-to-Earth (DTE) comms evaluation
              </p>
            </div>
          </div>

          {/* Ephemeris badge */}
          <div className="flex items-center gap-2">
            {isApproxEphem ? (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-950/60 px-3 py-1 text-xs text-amber-300 ring-1 ring-amber-800/60">
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Analytical Mock Ephemeris</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/60 px-3 py-1 text-xs text-emerald-300 ring-1 ring-emerald-800/60">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>JPL SPICE Ephemeris Active</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 pt-6">
        {/* Site Selector & Custom Coordinates Section */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-300">
                <span>Landing Site Catalog</span>
                <select
                  value={isCustomMode ? 'custom' : siteId}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomMode(true)
                    } else {
                      setIsCustomMode(false)
                      setSiteId(e.target.value)
                    }
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 focus:border-amber-500 focus:outline-none"
                >
                  <optgroup label="Curated Polar & Mission Sites">
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.lat >= 0 ? '+' : ''}{s.lat.toFixed(1)}°, {s.lon.toFixed(1)}°E)
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Custom Coordinates">
                    <option value="custom">★ Enter Custom Lat / Lon / Alt</option>
                  </optgroup>
                </select>
              </label>

              {/* Site Details Pill */}
              <div className="flex flex-wrap items-center gap-2 pt-4 text-xs font-mono text-slate-400">
                <span className="rounded bg-slate-800 px-2 py-1 text-slate-300">
                  Lat: <b className="text-white">{activeSite.lat.toFixed(3)}°</b>
                </span>
                <span className="rounded bg-slate-800 px-2 py-1 text-slate-300">
                  Lon: <b className="text-white">{activeSite.lon.toFixed(3)}°E</b>
                </span>
                <span className="rounded bg-slate-800 px-2 py-1 text-slate-300">
                  Alt: <b className="text-white">{activeSite.alt_m} m</b>
                </span>
                {activeSite.mission && (
                  <span className="rounded bg-amber-500/10 px-2 py-1 text-amber-300 ring-1 ring-amber-500/20 font-sans">
                    {activeSite.mission}
                  </span>
                )}
                {activeSite.horizon ? (
                  <span className="rounded bg-emerald-500/10 px-2 py-1 text-emerald-300 ring-1 ring-emerald-500/20 font-sans">
                    ✓ LOLA DEM Skyline
                  </span>
                ) : (
                  <span className="rounded bg-slate-800 px-2 py-1 text-slate-400 font-sans">
                    Smooth Sphere Horizon
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Expandable Custom Site Form */}
          {isCustomMode && (
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-slate-300">Coordinates:</span>
              <label className="flex items-center gap-1.5">
                <span className="text-slate-400">Lat:</span>
                <input
                  type="number"
                  step="0.01"
                  min="-90"
                  max="90"
                  value={customLat}
                  onChange={(e) => setCustomLat(Number(e.target.value))}
                  className="w-24 rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-white"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-slate-400">Lon (°E):</span>
                <input
                  type="number"
                  step="0.01"
                  min="-180"
                  max="360"
                  value={customLon}
                  onChange={(e) => setCustomLon(Number(e.target.value))}
                  className="w-24 rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-white"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-slate-400">Alt (m):</span>
                <input
                  type="number"
                  step="10"
                  value={customAlt}
                  onChange={(e) => setCustomAlt(Number(e.target.value))}
                  className="w-20 rounded border border-slate-700 bg-slate-800 px-2 py-1 font-mono text-white"
                />
              </label>
              <button
                onClick={handleApplyCustomCoords}
                className="rounded-lg bg-amber-500 px-3 py-1 font-semibold text-slate-950 hover:bg-amber-400 shadow-sm transition-colors"
              >
                Apply Coordinates
              </button>
            </div>
          )}
        </section>

        {/* Time Control Bar & Schedule-Slip Modeling (Person C Task 4) */}
        <section>
          <ScheduleSlip
            site={activeSite}
            currentTime={t}
            onTimeChange={(newT) => setT(newT)}
          />
        </section>

        {/* Horizon Panorama (Person C Task 1) */}
        <section>
          <Panorama
            site={activeSite}
            t={t}
          />
        </section>

        {/* Real-time Telemetry & 30-Day Mission Metrics Cards (Person C Task 2) */}
        <section>
          <Metrics
            site={activeSite}
            topo={now}
            events={ev}
            summary={sum}
            t={t}
          />
        </section>

        {/* 30-Day Timeline Ribbon (Person C Task 3) */}
        <section>
          <Timeline
            events={ev}
            windowStart={windowStart}
            windowDays={30}
            currentT={t}
            onTimeChange={(newT) => setT(newT)}
            onWindowStartChange={(newStart) => setWindowStart(newStart)}
          />
        </section>

        {/* Footer & Verification Note */}
        <footer className="mt-8 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-500 space-y-2">
          <p>
            Developed for NASA Space Apps Challenge 2026 • <b>Lunar Landing Site Navigator</b>
          </p>
          <p className="text-[11px] text-slate-600">
            Celestial body vectors in Moon Mean-Earth frame (`MOON_ME`) validated against NASA JPL Horizons within 0.05° tolerance.
            Polar terrain silhouette derived from NASA LOLA DEM.
          </p>
        </footer>
      </div>
    </main>
  )
}
