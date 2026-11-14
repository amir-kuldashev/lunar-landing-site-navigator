import type { Events, Site, Summary, Topo } from '../core'

interface MetricsProps {
  site: Site
  topo: Topo
  events: Events
  summary: Summary
  t: number
  className?: string
}

function fmtDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return 'None in next 30 days'
  if (ms <= 0) return 'Just transitioned'
  const totalHours = ms / 3600000
  if (totalHours >= 48) {
    const days = totalHours / 24
    return `${days.toFixed(1)} days (${totalHours.toFixed(0)} h)`
  }
  const h = Math.floor(totalHours)
  const m = Math.floor((totalHours - h) * 60)
  return `${h}h ${m}m`
}

export function Metrics({
  site,
  topo,
  events,
  summary,
  t,
  className = '',
}: MetricsProps) {
  const { sun, earth } = topo

  // Sun State
  const sunFractionPct = sun.visibleFraction * 100
  const isSunFullyLit = sun.visibleFraction >= 0.99
  const isSunPartial = sun.visibleFraction > 0 && sun.visibleFraction < 0.99
  const isSunDark = sun.visibleFraction === 0

  const sunStatus = isSunFullyLit
    ? { label: 'FULL SUNLIGHT', color: 'emerald', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' }
    : isSunPartial
    ? { label: 'PARTIAL / GRAZING', color: 'amber', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' }
    : { label: 'LUNAR NIGHT', color: 'rose', bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400' }

  // Earth State
  const isEarthVisible = earth.visible
  const isEarthMarginal = isEarthVisible && earth.el < 3.0 // Low grazing angle vulnerable to terrain bumps
  const earthStatus = !isEarthVisible
    ? { label: 'BLOCKED / OCCULTED', color: 'rose', bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400' }
    : isEarthMarginal
    ? { label: 'MARGINAL (GRAZING)', color: 'amber', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' }
    : { label: 'DIRECT LINK ESTABLISHED', color: 'emerald', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' }

  // 30-Day metrics status colors
  const litPctColor =
    summary.litPct >= 70 ? 'text-emerald-400' : summary.litPct >= 40 ? 'text-amber-400' : 'text-rose-400'
  const dtePctColor =
    summary.dtePct >= 80 ? 'text-emerald-400' : summary.dtePct >= 50 ? 'text-amber-400' : 'text-rose-400'
  const bothPctColor =
    summary.bothPct >= 60 ? 'text-emerald-400' : summary.bothPct >= 30 ? 'text-amber-400' : 'text-rose-400'

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Real-time Telemetry Grid: Sun & Earth */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Sun Telemetry Card */}
        <div className={`rounded-xl border p-4 shadow-lg backdrop-blur-sm transition-all ${sunStatus.bg} ${sunStatus.border}`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isSunDark ? 'bg-rose-400' : isSunPartial ? 'bg-amber-400' : 'bg-amber-300'
                }`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  isSunDark ? 'bg-rose-500' : isSunPartial ? 'bg-amber-500' : 'bg-amber-400'
                }`} />
              </span>
              <h3 className="font-semibold text-slate-100 flex items-center gap-1.5">
                Solar Illumination & Power
              </h3>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${sunStatus.bg} ${sunStatus.border} ${sunStatus.text}`}>
              {sunStatus.label}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-400">Sun Elevation</div>
              <div className="text-xl font-bold font-mono text-slate-100">
                {sun.el >= 0 ? '+' : ''}{sun.el.toFixed(2)}°
              </div>
              <div className="text-xs text-slate-500">
                Skyline: {sun.horizonEl >= 0 ? '+' : ''}{sun.horizonEl.toFixed(2)}°
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400">Azimuth Angle</div>
              <div className="text-xl font-bold font-mono text-slate-100">
                {sun.az.toFixed(1)}°
              </div>
              <div className="text-xs text-slate-500">
                Disk radius: {sun.radius.toFixed(2)}°
              </div>
            </div>

            <div className="col-span-2 pt-2 border-t border-slate-800/50">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Lit Disk Fraction:</span>
                <span className={`font-mono font-bold ${sunStatus.text}`}>{sunFractionPct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    isSunDark ? 'bg-rose-500' : isSunPartial ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, sunFractionPct))}%` }}
                />
              </div>
            </div>

            <div className="col-span-2 pt-2 border-t border-slate-800/50 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {sun.visibleFraction > 0 ? 'Next Sunset:' : 'Next Sunrise:'}
              </span>
              <span className="font-mono text-sm font-semibold text-slate-200">
                {sun.visibleFraction > 0
                  ? fmtDuration(events.nextSunset ? events.nextSunset - t : null)
                  : fmtDuration(events.nextSunrise ? events.nextSunrise - t : null)}
              </span>
            </div>
          </div>
        </div>

        {/* Earth Telemetry Card */}
        <div className={`rounded-xl border p-4 shadow-lg backdrop-blur-sm transition-all ${earthStatus.bg} ${earthStatus.border}`}>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  !isEarthVisible ? 'bg-rose-400' : isEarthMarginal ? 'bg-amber-400' : 'bg-sky-400'
                }`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  !isEarthVisible ? 'bg-rose-500' : isEarthMarginal ? 'bg-amber-500' : 'bg-sky-400'
                }`} />
              </span>
              <h3 className="font-semibold text-slate-100 flex items-center gap-1.5">
                Direct-to-Earth (DTE) Comms
              </h3>
            </div>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${earthStatus.bg} ${earthStatus.border} ${earthStatus.text}`}>
              {earthStatus.label}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-slate-400">Earth Elevation</div>
              <div className="text-xl font-bold font-mono text-slate-100">
                {earth.el >= 0 ? '+' : ''}{earth.el.toFixed(2)}°
              </div>
              <div className="text-xs text-slate-500">
                Skyline: {earth.horizonEl >= 0 ? '+' : ''}{earth.horizonEl.toFixed(2)}°
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400">Azimuth Angle</div>
              <div className="text-xl font-bold font-mono text-slate-100">
                {earth.az.toFixed(1)}°
              </div>
              <div className="text-xs text-slate-500">
                Disk radius: {earth.radius.toFixed(2)}°
              </div>
            </div>

            <div className="col-span-2 pt-2 border-t border-slate-800/50">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Line-of-Sight Margin:</span>
                <span className={`font-mono font-bold ${
                  earth.el - earth.horizonEl > 3 ? 'text-emerald-400' : earth.el - earth.horizonEl > 0 ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {earth.el - earth.horizonEl >= 0 ? '+' : ''}{(earth.el - earth.horizonEl).toFixed(2)}°
                </span>
              </div>
              <div className="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    earth.visible ? (isEarthMarginal ? 'bg-amber-400' : 'bg-sky-400') : 'bg-rose-500'
                  }`}
                  style={{ width: earth.visible ? '100%' : '0%' }}
                />
              </div>
            </div>

            <div className="col-span-2 pt-2 border-t border-slate-800/50 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {earth.visible ? 'Next Earthset:' : 'Next Earthrise:'}
              </span>
              <span className="font-mono text-sm font-semibold text-slate-200">
                {earth.visible
                  ? fmtDuration(events.nextEarthset ? events.nextEarthset - t : null)
                  : fmtDuration(events.nextEarthrise ? events.nextEarthrise - t : null)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 30-Day Mission Window Summary Statistics */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="font-semibold text-slate-100 flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              30-Day Mission Window Overview
            </h3>
            <p className="text-xs text-slate-400">
              Aggregated availability for lunar operations from current epoch
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800">
            Site: {site.lat >= 0 ? '+' : ''}{site.lat.toFixed(3)}°, {site.lon >= 0 ? '+' : ''}{site.lon.toFixed(3)}°E · Alt: {site.alt_m}m
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {/* Solar Lit % */}
          <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800/80">
            <div className="text-xs text-slate-400 mb-1">Solar Illumination</div>
            <div className={`text-2xl font-bold font-mono ${litPctColor}`}>
              {summary.litPct.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Avg power: {summary.meanSolarPct.toFixed(1)}%
            </div>
          </div>

          {/* DTE Comms % */}
          <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800/80">
            <div className="text-xs text-slate-400 mb-1">DTE Comms Uptime</div>
            <div className={`text-2xl font-bold font-mono ${dtePctColor}`}>
              {summary.dtePct.toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Earth line-of-sight
            </div>
          </div>

          {/* Both (Power + Comms) % */}
          <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800/80 ring-1 ring-emerald-500/30">
            <div className="text-xs text-emerald-300 font-medium mb-1">Simultaneous (Power+DTE)</div>
            <div className={`text-2xl font-bold font-mono ${bothPctColor}`}>
              {summary.bothPct.toFixed(1)}%
            </div>
            <div className="text-[11px] text-emerald-400/80 mt-0.5">
              Prime mission window
            </div>
          </div>

          {/* Longest Night */}
          <div className="rounded-lg bg-slate-950/60 p-3 border border-slate-800/80">
            <div className="text-xs text-slate-400 mb-1">Longest Lunar Night</div>
            <div className="text-2xl font-bold font-mono text-slate-100">
              {summary.longestNight_h >= 24
                ? `${(summary.longestNight_h / 24).toFixed(1)} d`
                : `${summary.longestNight_h.toFixed(1)} h`}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Max battery drain
            </div>
          </div>
        </div>

        {/* Detailed Secondary Row */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-3 border-t border-slate-800/60 text-xs text-slate-400">
          <div className="flex items-center justify-between px-2 py-1 bg-slate-950/40 rounded">
            <span>Longest Comms Blackout:</span>
            <span className="font-mono text-slate-200 font-medium">
              {summary.longestDteGap_h >= 24
                ? `${(summary.longestDteGap_h / 24).toFixed(1)} days`
                : `${summary.longestDteGap_h.toFixed(1)} h`}
            </span>
          </div>

          <div className="flex items-center justify-between px-2 py-1 bg-slate-950/40 rounded">
            <span>Sun Elevation Range:</span>
            <span className="font-mono text-slate-200 font-medium">
              {summary.minSunEl >= 0 ? '+' : ''}{summary.minSunEl.toFixed(1)}° to {summary.maxSunEl >= 0 ? '+' : ''}{summary.maxSunEl.toFixed(1)}°
            </span>
          </div>

          <div className="flex items-center justify-between px-2 py-1 bg-slate-950/40 rounded">
            <span>Terrain Model:</span>
            <span className={`font-medium ${site.horizon ? 'text-emerald-400' : 'text-slate-400'}`}>
              {site.horizon ? 'LOLA 720-Azimuth DEM' : 'Smooth Sphere (Dip: -0.09°)'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
