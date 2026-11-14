import { useMemo, useRef } from 'react'
import { getEphemeris, topo, type Site } from '../core'
import { DAY, HOUR } from '../lib/format'

/**
 * A full year at one site, one cell per day: how much of the day has sunlight and how much has
 * Earth in view. Shows the seasonal pattern that a 30-day window hides. Click a day to go there.
 */

interface Props {
  site: Site
  t: number
  onChange: (t: number) => void
}

const SAMPLES_PER_DAY = 8
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function YearStrip({ site, t, onChange }: Props) {
  const year = new Date(t).getUTCFullYear()
  const track = useRef<HTMLDivElement>(null)

  const model = useMemo(() => {
    const start = Date.UTC(year, 0, 1)
    const nDays = Math.round((Date.UTC(year + 1, 0, 1) - start) / DAY)
    const [lo, hi] = getEphemeris().range
    const sun = new Float32Array(nDays)
    const earth = new Float32Array(nDays)
    let sunTotal = 0
    let earthTotal = 0
    for (let d = 0; d < nDays; d++) {
      let s = 0
      let e = 0
      for (let k = 0; k < SAMPLES_PER_DAY; k++) {
        const time = start + d * DAY + (k + 0.5) * (24 / SAMPLES_PER_DAY) * HOUR
        if (time < lo || time > hi) continue
        const v = topo(site, time)
        s += v.sun.visibleFraction
        if (v.earth.visible) e += 1
      }
      sun[d] = s / SAMPLES_PER_DAY
      earth[d] = e / SAMPLES_PER_DAY
      sunTotal += sun[d]
      earthTotal += earth[d]
    }
    const monthStarts = MONTHS.map((_, m) => (Date.UTC(year, m, 1) - start) / DAY / nDays)
    return { start, nDays, sun, earth, monthStarts, sunPct: (100 * sunTotal) / nDays, earthPct: (100 * earthTotal) / nDays }
  }, [site, year])

  const day = Math.min(model.nDays - 1, Math.max(0, Math.floor((t - model.start) / DAY)))
  const seek = (clientX: number) => {
    const el = track.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const f = Math.min(Math.max((clientX - r.left) / r.width, 0), 0.9999)
    // Keep the time of day, change the date.
    onChange(model.start + Math.floor(f * model.nDays) * DAY + (((t % DAY) + DAY) % DAY))
  }

  const row = (values: Float32Array, color: string) => (
    <div className="flex h-5 overflow-hidden rounded-[3px] bg-raised">
      {Array.from(values, (v, i) => (
        <span key={i} className="h-full flex-1" style={{ background: color, opacity: v }} />
      ))}
    </div>
  )

  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 text-xs">
      <div className="flex flex-col gap-1.5 text-muted">
        <span className="flex h-5 items-center">Sunlight</span>
        <span className="flex h-5 items-center">Earth in view</span>
      </div>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={`Day of ${year}`}
        aria-valuemin={1}
        aria-valuemax={model.nDays}
        aria-valuenow={day + 1}
        className="relative cursor-pointer touch-none select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          seek(e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.buttons & 1) seek(e.clientX)
        }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 7 * DAY : DAY
          if (e.key === 'ArrowRight') onChange(t + step)
          if (e.key === 'ArrowLeft') onChange(t - step)
        }}
      >
        <div className="flex flex-col gap-1.5">
          {row(model.sun, 'var(--color-sun)')}
          {row(model.earth, 'var(--color-earth)')}
        </div>
        <div
          className="pointer-events-none absolute -bottom-1 -top-1 w-px bg-white"
          style={{ left: `${((day + 0.5) / model.nDays) * 100}%` }}
          aria-hidden
        />
      </div>
      <div />
      <div className="relative mt-2 h-4 text-muted">
        {model.monthStarts.map((f, m) => (
          <span key={m} className="absolute top-0" style={{ left: `${f * 100}%` }}>
            {MONTHS[m]}
          </span>
        ))}
      </div>
      <div />
      <p className="mt-2 text-muted">
        Across {year}: sunlight {model.sunPct.toFixed(0)}% of the time, Earth in view {model.earthPct.toFixed(0)}%.
        Brighter cells mean more of that day. Click a day to go there.
      </p>
    </div>
  )
}
