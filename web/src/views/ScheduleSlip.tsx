import { useState, useMemo, useEffect, useRef } from 'react'
import { summary, type Site, type Summary } from '../core'

interface ScheduleSlipProps {
  site: Site
  currentTime: number
  onTimeChange: (newT: number) => void
  className?: string
}

const DAY_MS = 86400000
const HOUR_MS = 3600000

export function ScheduleSlip({
  site,
  currentTime,
  onTimeChange,
  className = '',
}: ScheduleSlipProps) {
  // Baseline date for slip scenario comparison
  const [baselineT, setBaselineT] = useState<number>(() => currentTime)
  const [slipDays, setSlipDays] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(6) // in hours of sim time per real second

  const slippedT = baselineT + slipDays * DAY_MS

  // Compute baseline summary and slipped summary
  const baselineSummary: Summary = useMemo(() => {
    return summary(site, baselineT, 30)
  }, [site, baselineT])

  const slippedSummary: Summary = useMemo(() => {
    if (slipDays === 0) return baselineSummary
    return summary(site, slippedT, 30)
  }, [site, slippedT, slipDays, baselineSummary])

  // Play / Scrub animation loop
  const animRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current)
      lastFrameTimeRef.current = null
      return
    }

    const step = (now: number) => {
      if (lastFrameTimeRef.current !== null) {
        const deltaRealMs = now - lastFrameTimeRef.current
        // Advance sim time according to playbackSpeed (hours/sec)
        const simDeltaMs = (deltaRealMs / 1000) * playbackSpeed * HOUR_MS
        onTimeChange(currentTime + simDeltaMs)
      }
      lastFrameTimeRef.current = now
      animRef.current = requestAnimationFrame(step)
    }

    animRef.current = requestAnimationFrame(step)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [isPlaying, playbackSpeed, currentTime, onTimeChange])

  // Delta calculations
  const deltaLit = slippedSummary.litPct - baselineSummary.litPct
  const deltaSolarMean = slippedSummary.meanSolarPct - baselineSummary.meanSolarPct
  const deltaDte = slippedSummary.dtePct - baselineSummary.dtePct
  const deltaBoth = slippedSummary.bothPct - baselineSummary.bothPct
  const deltaNight = slippedSummary.longestNight_h - baselineSummary.longestNight_h
  const deltaDteGap = slippedSummary.longestDteGap_h - baselineSummary.longestDteGap_h

  // Format helper for +/- values
  const fmtDeltaPct = (val: number) => {
    const sign = val > 0 ? '+' : ''
    return `${sign}${val.toFixed(1)}%`
  }

  const fmtDeltaHours = (val: number) => {
    const sign = val > 0 ? '+' : ''
    if (Math.abs(val) >= 48) {
      return `${sign}${(val / 24).toFixed(1)} days (${sign}${val.toFixed(0)} h)`
    }
    return `${sign}${val.toFixed(1)} h`
  }

  // Handle direct datetime input change
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const parsed = Date.parse(`${e.target.value}:00Z`)
      if (!isNaN(parsed)) {
        onTimeChange(parsed)
        setBaselineT(parsed)
        setSlipDays(0)
      }
    }
  }

  const toLocalInput = (t: number): string => {
    return new Date(t).toISOString().slice(0, 16)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Time Control Bar: Play / Step / Scrub */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg backdrop-blur-sm">
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          {/* Play / Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors shadow-sm ${
              isPlaying
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            {isPlaying ? (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play Time
              </>
            )}
          </button>

          {/* Stepper buttons */}
          <div className="flex items-center rounded-lg border border-slate-700 bg-slate-800/80 p-0.5 text-xs text-slate-300">
            <button
              onClick={() => onTimeChange(currentTime - 24 * HOUR_MS)}
              className="px-2 py-1 rounded hover:bg-slate-700 hover:text-white"
              title="Step -1 Day"
            >
              -1d
            </button>
            <button
              onClick={() => onTimeChange(currentTime - HOUR_MS)}
              className="px-2 py-1 rounded hover:bg-slate-700 hover:text-white"
              title="Step -1 Hour"
            >
              -1h
            </button>
            <button
              onClick={() => onTimeChange(currentTime + HOUR_MS)}
              className="px-2 py-1 rounded hover:bg-slate-700 hover:text-white"
              title="Step +1 Hour"
            >
              +1h
            </button>
            <button
              onClick={() => onTimeChange(currentTime + 24 * HOUR_MS)}
              className="px-2 py-1 rounded hover:bg-slate-700 hover:text-white"
              title="Step +1 Day"
            >
              +1d
            </button>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span className="hidden sm:inline">Speed:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-slate-200"
            >
              <option value={1}>1 h/s</option>
              <option value={6}>6 h/s</option>
              <option value={24}>1 d/s</option>
              <option value={168}>7 d/s</option>
            </select>
          </div>
        </div>

        {/* Current Time Picker & UTC Display */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <span className="text-slate-400">Epoch (UTC):</span>
            <input
              type="datetime-local"
              value={toLocalInput(currentTime)}
              onChange={handleDateInputChange}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-mono text-slate-100 focus:border-amber-500 focus:outline-none"
            />
          </label>

          <button
            onClick={() => {
              const nowUtc = Date.now()
              onTimeChange(nowUtc)
              setBaselineT(nowUtc)
              setSlipDays(0)
            }}
            className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:text-white"
            title="Reset to Present Earth Date"
          >
            Today
          </button>
        </div>
      </div>

      {/* Schedule-Slip Scenario Modeling ("What If" Slider & Delta Card) */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-500/20 text-sky-300">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Schedule Slip Analysis
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-sky-950 border border-sky-800/80 text-sky-300">
                  {slipDays === 0 ? 'Baseline (0 days)' : `${slipDays > 0 ? '+' : ''}${slipDays} days`}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Simulate launch slips (e.g. 3-week delay) and instantly evaluate impact on power and DTE comms
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {slipDays !== 0 && (
              <button
                onClick={() => {
                  onTimeChange(slippedT)
                  setBaselineT(slippedT)
                  setSlipDays(0)
                }}
                className="rounded-lg bg-sky-600 px-3 py-1 font-semibold text-white shadow hover:bg-sky-500 transition-colors"
              >
                Apply Slipped Date as Current
              </button>
            )}
            <button
              onClick={() => {
                setBaselineT(currentTime)
                setSlipDays(0)
              }}
              className="rounded border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 hover:text-white"
            >
              Reset to 0
            </button>
          </div>
        </div>

        {/* Schedule-Slip Slider & Quick Preset Buttons */}
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-400">
            <span>-30 Days (Early Arrival)</span>
            <span className="font-mono font-bold text-slate-200">
              Baseline: {new Date(baselineT).toISOString().slice(0, 10)} → Slipped: {new Date(slippedT).toISOString().slice(0, 10)}
            </span>
            <span>+30 Days (Delay)</span>
          </div>

          <div className="relative">
            <input
              type="range"
              min={-30}
              max={30}
              step={1}
              value={slipDays}
              onChange={(e) => {
                const days = Number(e.target.value)
                setSlipDays(days)
                onTimeChange(baselineT + days * DAY_MS)
              }}
              className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-sky-500 border border-slate-800"
            />
            {/* Center tick */}
            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-600 pointer-events-none" />
          </div>

          {/* Preset Slip Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
            <span className="text-slate-400 mr-1">Quick Presets:</span>
            {[-14, -7, 0, 7, 14, 21, 28].map((days) => (
              <button
                key={`preset-${days}`}
                onClick={() => {
                  setSlipDays(days)
                  onTimeChange(baselineT + days * DAY_MS)
                }}
                className={`px-2.5 py-0.5 rounded font-mono transition-colors ${
                  slipDays === days
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {days === 0 ? '0' : `${days > 0 ? '+' : ''}${days}d`}
                {days === 21 && ' (3 wks)'}
                {days === 28 && ' (1 mo)'}
              </button>
            ))}
          </div>
        </div>

        {/* "What Changed" Delta Card */}
        <div className="mt-4 rounded-xl border border-slate-800/90 bg-slate-950/70 p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <span>⚡</span> "What Changed" Scenario Comparison
            </h4>
            <span className="text-xs text-slate-400">
              Comparing 30-day windows: Baseline vs {slipDays >= 0 ? `+${slipDays}` : slipDays} Days Slip
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {/* Solar Illumination Delta */}
            <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Solar Illumination</div>
              <div className="font-mono text-base font-bold text-slate-200">
                {baselineSummary.litPct.toFixed(1)}% → {slippedSummary.litPct.toFixed(1)}%
              </div>
              <div className={`text-xs font-mono font-semibold mt-1 flex items-center gap-1 ${
                deltaLit > 0 ? 'text-emerald-400' : deltaLit < 0 ? 'text-rose-400' : 'text-slate-400'
              }`}>
                {deltaLit !== 0 && (deltaLit > 0 ? '▲' : '▼')} {fmtDeltaPct(deltaLit)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 font-mono">
                Power avg: {fmtDeltaPct(deltaSolarMean)}
              </div>
            </div>

            {/* DTE Comms Delta */}
            <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">DTE Comms Link</div>
              <div className="font-mono text-base font-bold text-slate-200">
                {baselineSummary.dtePct.toFixed(1)}% → {slippedSummary.dtePct.toFixed(1)}%
              </div>
              <div className={`text-xs font-mono font-semibold mt-1 flex items-center gap-1 ${
                deltaDte > 0 ? 'text-emerald-400' : deltaDte < 0 ? 'text-rose-400' : 'text-slate-400'
              }`}>
                {deltaDte !== 0 && (deltaDte > 0 ? '▲' : '▼')} {fmtDeltaPct(deltaDte)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 font-mono">
                Gap Δ: {fmtDeltaHours(deltaDteGap)}
              </div>
            </div>

            {/* Simultaneous Window Delta */}
            <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800 ring-1 ring-emerald-500/30">
              <div className="text-xs text-emerald-300 font-medium mb-1">Joint Window (Power+Comms)</div>
              <div className="font-mono text-base font-bold text-slate-200">
                {baselineSummary.bothPct.toFixed(1)}% → {slippedSummary.bothPct.toFixed(1)}%
              </div>
              <div className={`text-xs font-mono font-semibold mt-1 flex items-center gap-1 ${
                deltaBoth > 0 ? 'text-emerald-400' : deltaBoth < 0 ? 'text-rose-400' : 'text-slate-400'
              }`}>
                {deltaBoth !== 0 && (deltaBoth > 0 ? '▲' : '▼')} {fmtDeltaPct(deltaBoth)}
              </div>
            </div>

            {/* Longest Night Delta */}
            <div className="rounded-lg bg-slate-900/80 p-3 border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Longest Night (Battery Drain)</div>
              <div className="font-mono text-base font-bold text-slate-200">
                {baselineSummary.longestNight_h.toFixed(0)}h → {slippedSummary.longestNight_h.toFixed(0)}h
              </div>
              <div className={`text-xs font-mono font-semibold mt-1 flex items-center gap-1 ${
                deltaNight < 0 ? 'text-emerald-400' : deltaNight > 0 ? 'text-rose-400' : 'text-slate-400'
              }`}>
                {deltaNight !== 0 && (deltaNight < 0 ? '▼ (improved)' : '▲ (worse)')} {fmtDeltaHours(deltaNight)}
              </div>
            </div>
          </div>

          {/* Operational Assessment Verdict */}
          <div className="mt-3 rounded-lg bg-slate-900/60 p-3 border border-slate-800/80 text-xs">
            <span className="font-semibold text-slate-300">Operational Assessment: </span>
            {slipDays === 0 ? (
              <span className="text-slate-400">
                Currently showing baseline mission scenario. Adjust slider above to simulate launch slip impact.
              </span>
            ) : deltaBoth > 3 && deltaNight <= 0 ? (
              <span className="text-emerald-400 font-medium">
                Highly Favorable Slip: Simultaneous power and comms window expands by {fmtDeltaPct(deltaBoth)} with no increase in continuous darkness.
              </span>
            ) : deltaNight > 24 ? (
              <span className="text-rose-400 font-medium">
                High Thermal/Power Risk: Longest continuous night increases by {fmtDeltaHours(deltaNight)}. Requires significant additional battery reserve or sleep mode.
              </span>
            ) : deltaDte < -5 ? (
              <span className="text-amber-400 font-medium">
                Communications Warning: Direct Earth line-of-sight drops by {fmtDeltaPct(Math.abs(deltaDte))}. Ground contact windows are reduced.
              </span>
            ) : (
              <span className="text-slate-300">
                Moderate impact: Solar availability {deltaLit >= 0 ? '+' : ''}{deltaLit.toFixed(1)}%, DTE comms {deltaDte >= 0 ? '+' : ''}{deltaDte.toFixed(1)}%.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
