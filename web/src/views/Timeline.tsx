import { useMemo, useRef, useState, useCallback } from 'react'
import type { Events, Interval } from '../core'
import { intersectIntervals } from './intervals'

interface TimelineProps {
  events: Events
  windowStart: number
  windowDays?: number
  currentT: number
  onTimeChange: (t: number) => void
  onWindowStartChange?: (newStart: number) => void
  className?: string
}

const DAY_MS = 86400000

export function Timeline({
  events,
  windowStart,
  windowDays = 30,
  currentT,
  onTimeChange,
  onWindowStartChange,
  className = '',
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [hoverT, setHoverT] = useState<number | null>(null)
  const [hoverPos, setHoverPos] = useState<{ x: number; pct: number } | null>(null)

  const windowEnd = windowStart + windowDays * DAY_MS
  const totalDuration = windowEnd - windowStart

  // Calculate intersection of sunlight & dte intervals
  const bothIntervals = useMemo(
    () => intersectIntervals(events.sunlight, events.dte),
    [events.sunlight, events.dte],
  )

  // Convert time to percentage (0..100)
  const timeToPct = useCallback(
    (time: number): number => {
      const pct = ((time - windowStart) / totalDuration) * 100
      return Math.max(0, Math.min(100, pct))
    },
    [windowStart, totalDuration],
  )

  // Convert clientX to timestamp
  const clientXToTime = useCallback(
    (clientX: number): number => {
      if (!containerRef.current) return currentT
      const rect = containerRef.current.getBoundingClientRect()
      const x = clientX - rect.left
      const ratio = Math.max(0, Math.min(1, x / rect.width))
      return windowStart + ratio * totalDuration
    },
    [windowStart, totalDuration, currentT],
  )

  // Pointer drag handlers for smooth scrubbing
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const newT = clientXToTime(e.clientX)
    onTimeChange(newT)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      const newT = clientXToTime(e.clientX)
      onTimeChange(newT)
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      if (x >= 0 && x <= rect.width) {
        const ratio = x / rect.width
        setHoverT(windowStart + ratio * totalDuration)
        setHoverPos({ x, pct: ratio * 100 })
      } else {
        setHoverT(null)
        setHoverPos(null)
      }
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false)
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      // Ignored
    }
  }

  const handlePointerLeave = () => {
    if (!isDragging) {
      setHoverT(null)
      setHoverPos(null)
    }
  }

  // Generate tick markers across 30 days
  const ticks = useMemo(() => {
    const list: { day: number; t: number; dateStr: string; pct: number }[] = []
    const stepDays = windowDays <= 14 ? 1 : windowDays <= 35 ? 5 : 7

    for (let day = 0; day <= windowDays; day += stepDays) {
      const t = windowStart + day * DAY_MS
      const d = new Date(t)
      const dateStr = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      })
      list.push({
        day,
        t,
        dateStr,
        pct: (day / windowDays) * 100,
      })
    }
    return list
  }, [windowStart, windowDays])

  // Current cursor percentage
  const cursorPct = timeToPct(currentT)
  const isCursorInWindow = currentT >= windowStart && currentT <= windowEnd

  // Helper to render intervals
  const renderIntervals = (
    list: Interval[],
    bgClass: string,
    borderClass: string,
  ) => {
    return list.map((inv, idx) => {
      // Clamp to window bounds
      const clampedStart = Math.max(windowStart, inv.start)
      const clampedEnd = Math.min(windowEnd, inv.end)
      if (clampedStart >= clampedEnd) return null

      const leftPct = ((clampedStart - windowStart) / totalDuration) * 100
      const widthPct = ((clampedEnd - clampedStart) / totalDuration) * 100

      return (
        <div
          key={`inv-${idx}-${clampedStart}`}
          className={`absolute top-0 bottom-0 rounded-xs shadow-xs transition-opacity ${bgClass} ${borderClass}`}
          style={{
            left: `${leftPct}%`,
            width: `${Math.max(0.2, widthPct)}%`,
          }}
        />
      )
    })
  }

  return (
    <div className={`flex flex-col rounded-xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl backdrop-blur-sm ${className}`}>
      {/* Top Header & Window Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              30-Day Mission Timeline Ribbon
            </h2>
            <p className="text-xs text-slate-400">
              Drag cursor to scrub time • Three-tier activity profile for Sunlight, Comms, and Joint window
            </p>
          </div>
        </div>

        {/* Quick jump & window reset actions */}
        <div className="flex items-center gap-2 text-xs">
          {onWindowStartChange && !isCursorInWindow && (
            <button
              onClick={() => onWindowStartChange(currentT)}
              className="px-2.5 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 font-medium transition-colors"
            >
              Center Window on Cursor
            </button>
          )}

          {events.nextSunrise && (
            <button
              onClick={() => onTimeChange(events.nextSunrise!)}
              className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Jump to Next Sunrise"
            >
              Sunrise ↗
            </button>
          )}

          {events.nextSunset && (
            <button
              onClick={() => onTimeChange(events.nextSunset!)}
              className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Jump to Next Sunset"
            >
              Sunset ↘
            </button>
          )}

          {events.nextEarthrise && (
            <button
              onClick={() => onTimeChange(events.nextEarthrise!)}
              className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              title="Jump to Next Earthrise"
            >
              Earthrise ↗
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Timeline Container */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        className="relative touch-none cursor-ew-resize select-none py-2"
      >
        {/* Track Rows Container */}
        <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-950 p-2 shadow-inner">
          {/* Row 1: Solar Illumination */}
          <div className="flex items-center gap-2">
            <div className="w-20 text-[11px] font-semibold text-amber-300 flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Sunlight
            </div>
            <div className="relative h-6 flex-1 rounded bg-slate-900 overflow-hidden border border-slate-800/80">
              {renderIntervals(events.sunlight, 'bg-amber-400/90', 'border-t border-amber-300/40')}
            </div>
          </div>

          {/* Row 2: DTE Comms */}
          <div className="flex items-center gap-2">
            <div className="w-20 text-[11px] font-semibold text-sky-300 flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
              DTE Comms
            </div>
            <div className="relative h-6 flex-1 rounded bg-slate-900 overflow-hidden border border-slate-800/80">
              {renderIntervals(events.dte, 'bg-sky-500/90', 'border-t border-sky-300/40')}
            </div>
          </div>

          {/* Row 3: Joint Both (Power & Comms) */}
          <div className="flex items-center gap-2">
            <div className="w-20 text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
              Joint Window
            </div>
            <div className="relative h-6 flex-1 rounded bg-slate-900 overflow-hidden border border-emerald-900/40">
              {renderIntervals(bothIntervals, 'bg-emerald-400/95', 'border-t border-emerald-200/50')}
            </div>
          </div>
        </div>

        {/* Hover Time Indicator Line & Tooltip */}
        {hoverPos && (
          <div
            className="pointer-events-none absolute top-0 bottom-6 z-20"
            style={{ left: `calc(5rem + ${hoverPos.x}px)` }}
          >
            <div className="h-full w-px bg-slate-400 opacity-70 border-l border-dashed border-slate-300" />
            <div className="absolute top-0 -translate-x-1/2 -translate-y-full mb-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-200 shadow border border-slate-700 whitespace-nowrap">
              {hoverT ? new Date(hoverT).toISOString().slice(0, 16).replace('T', ' ') : ''} UTC
            </div>
          </div>
        )}

        {/* Draggable Active Time Cursor */}
        {isCursorInWindow && (
          <div
            className="pointer-events-none absolute top-1 bottom-4 z-30 flex flex-col items-center"
            style={{
              left: `calc(5rem + 8px + (100% - 5rem - 16px) * ${cursorPct / 100})`,
              transform: 'translateX(-50%)',
            }}
          >
            {/* Top Cursor Handle Badge */}
            <div className="flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold font-mono text-slate-950 shadow-lg ring-2 ring-slate-900">
              <span>NOW</span>
            </div>
            {/* Vertical Laser Needle */}
            <div className="w-0.5 flex-1 bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
            {/* Bottom Pin */}
            <div className="w-2 h-2 rotate-45 bg-amber-400 -mt-1 ring-2 ring-slate-900" />
          </div>
        )}

        {/* Time Ticks Axis (Days & Dates) */}
        <div className="relative mt-2 ml-24 mr-2 h-6">
          {ticks.map(({ day, dateStr, pct }) => (
            <div
              key={`tick-${day}`}
              className="absolute -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${pct}%` }}
            >
              <div className="h-1.5 w-px bg-slate-700" />
              <span className="text-[10px] font-medium text-slate-300 whitespace-nowrap">
                +{day}d
              </span>
              <span className="text-[9px] text-slate-500 whitespace-nowrap">
                {dateStr}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Ribbon Summary Footer */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-xs bg-amber-400"></span>
            <span>Sunlit Period</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-xs bg-sky-500"></span>
            <span>Earth in Sight (DTE)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-xs bg-emerald-400"></span>
            <span className="text-emerald-300 font-medium">Both Active (Power + DTE)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-xs bg-slate-900 border border-slate-800"></span>
            <span>Outage / Night</span>
          </div>
        </div>

        <div className="font-mono text-slate-300">
          Current: <span className="text-amber-400 font-semibold">{new Date(currentT).toISOString().slice(0, 16).replace('T', ' ')} UTC</span>
        </div>
      </div>
    </div>
  )
}
