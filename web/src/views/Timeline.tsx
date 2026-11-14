import { useRef } from 'react'
import type { Events, Interval } from '../core'
import { DAY, dateShortUTC } from '../lib/format'
import { intersectIntervals } from './intervals'

/** 30-day ribbon of sunlight and Earth visibility. Drag anywhere on it to move through time. */

interface Props {
  events: Events
  windowStart: number
  days: number
  t: number
  onChange: (t: number) => void
}

export default function Timeline({ events, windowStart, days, t, onChange }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const span = days * DAY
  const end = windowStart + span
  const pct = (time: number) => ((Math.min(Math.max(time, windowStart), end) - windowStart) / span) * 100

  const seek = (clientX: number) => {
    const el = track.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const f = Math.min(Math.max((clientX - r.left) / r.width, 0), 1)
    onChange(windowStart + f * span)
  }

  const bars = (list: Interval[], color: string) =>
    list
      .filter((i) => i.end > windowStart && i.start < end)
      .map((i) => (
        <span
          key={i.start}
          className="absolute inset-y-0 rounded-[3px]"
          style={{ left: `${pct(i.start)}%`, width: `${Math.max(pct(i.end) - pct(i.start), 0.15)}%`, background: color }}
        />
      ))

  const rows: { label: string; list: Interval[]; color: string }[] = [
    { label: 'Sunlight', list: events.sunlight, color: 'var(--color-sun)' },
    { label: 'Earth in view', list: events.dte, color: 'var(--color-earth)' },
    { label: 'Both', list: intersectIntervals(events.sunlight, events.dte), color: 'var(--color-ink)' },
  ]
  const ticks = Array.from({ length: Math.floor(days / 5) + 1 }, (_, i) => windowStart + i * 5 * DAY)

  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 text-xs">
      <div className="flex flex-col justify-between py-0.5 text-muted">
        {rows.map((r) => (
          <span key={r.label} className="flex h-4 items-center">
            {r.label}
          </span>
        ))}
      </div>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Time within the 30-day window"
        aria-valuemin={0}
        aria-valuemax={days}
        aria-valuenow={Number(((t - windowStart) / DAY).toFixed(2))}
        className="relative cursor-ew-resize touch-none select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          seek(e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) seek(e.clientX)
        }}
        onKeyDown={(e) => {
          const stepMs = e.shiftKey ? DAY : DAY / 24
          if (e.key === 'ArrowRight') onChange(t + stepMs)
          if (e.key === 'ArrowLeft') onChange(t - stepMs)
        }}
      >
        <div className="flex flex-col gap-1.5 py-0.5">
          {rows.map((r) => (
            <div key={r.label} className="relative h-4 overflow-hidden rounded-[3px] bg-raised">
              {bars(r.list, r.color)}
            </div>
          ))}
        </div>
        <div
          className="pointer-events-none absolute -bottom-1 -top-1 w-px bg-white"
          style={{ left: `${pct(t)}%` }}
          aria-hidden
        >
          <span className="absolute -left-[5px] -top-1 h-[11px] w-[11px] rounded-full border-2 border-white bg-black" />
        </div>
      </div>
      <div />
      <div className="relative mt-2 h-4 text-muted">
        {ticks.map((time, i) => (
          <span
            key={time}
            className="num absolute top-0 whitespace-nowrap"
            style={{
              left: `${pct(time)}%`,
              transform: i === 0 ? 'none' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {dateShortUTC(time)}
          </span>
        ))}
      </div>
    </div>
  )
}
