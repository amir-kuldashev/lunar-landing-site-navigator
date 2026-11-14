import { useId, useMemo, useState } from 'react'
import { horizonElevation, topo, type Site, type Topo } from '../core'
import { compass, DAY, HOUR } from '../lib/format'
import { useSize } from '../lib/useSize'

/**
 * The sky as seen from the site, unrolled: compass direction across, height above the horizon up.
 * Shows the skyline, where the Sun and Earth are now, and the paths they follow over the window.
 */

interface Props {
  site: Site
  now: Topo
  /** Start of the 30-day window the paths are drawn for. */
  windowStart: number
  days: number
  /** Fixed vertical range in degrees [bottom, top]. Used when several skies are compared on one scale. */
  range?: [number, number]
}

const PAD = { left: 44, right: 12, top: 12, bottom: 26 }

type Zoom = 'auto' | 'horizon' | 'sky'
const ZOOMS: { id: Zoom; label: string }[] = [
  { id: 'auto', label: 'Fit' },
  { id: 'horizon', label: 'Horizon' },
  { id: 'sky', label: 'Whole sky' },
]

function niceStep(range: number): number {
  for (const s of [1, 2, 5, 10, 15, 30]) if (range / s <= 6) return s
  return 30
}

/** Everything the panorama draws for one site and window, plus the vertical range that fits it. */
export function skyModel(site: Site, windowStart: number, days: number) {
  const track: { sun: [number, number]; earth: [number, number] }[] = []
  let maxEl = -90
  for (let t = windowStart; t <= windowStart + days * DAY; t += 2 * HOUR) {
    const v = topo(site, t)
    track.push({ sun: [v.sun.az, v.sun.el], earth: [v.earth.az, v.earth.el] })
    maxEl = Math.max(maxEl, v.sun.el, v.earth.el)
  }
  const skyline: [number, number][] = []
  let maxSky = -90
  let minSky = 90
  for (let az = 0; az <= 360; az += 1) {
    const el = horizonElevation(site.horizon, az)
    skyline.push([az, el])
    maxSky = Math.max(maxSky, el)
    minSky = Math.min(minSky, el)
  }
  const top = Math.min(90, Math.max(6, Math.ceil(Math.max(maxEl, maxSky) * 1.15 + 1)))
  // Leave room under the lowest point of the skyline (a ridge-top site looks down on its horizon).
  const bottom = Math.min(-Math.max(3, Math.round(top * 0.22)), Math.floor(minSky - 1.5))
  // Centre the view on Earth so its small libration loop never straddles the edge.
  const centre = Math.round(topo(site, windowStart).earth.az / 45) * 45
  return { track, skyline, top, bottom, centre, minSky }
}

export default function Panorama({ site, now, windowStart, days, range }: Props) {
  const uid = useId()
  const [ref, { width, height }] = useSize<HTMLDivElement>()
  const [zoom, setZoom] = useState<Zoom>('auto')
  const [pointer, setPointer] = useState<{ az: number; el: number } | null>(null)

  const model = useMemo(() => skyModel(site, windowStart, days), [site, windowStart, days])

  const W = Math.max(width, 200)
  const H = Math.max(height, 120)
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const { centre } = model
  // "Horizon" keeps the few degrees around the skyline, where polar sites live; "Whole sky" goes to the zenith.
  const top = range ? range[1] : zoom === 'auto' ? model.top : zoom === 'horizon' ? 10 : 90
  const bottom = range
    ? range[0]
    : zoom === 'auto'
      ? model.bottom
      : zoom === 'horizon'
        ? Math.min(-4, Math.floor(model.minSky - 1.5))
        : -12
  const x = (az: number) => PAD.left + ((((az - centre + 540) % 360) + 360) % 360) / 360 * iw
  const y = (el: number) => PAD.top + ((top - el) / (top - bottom)) * ih
  const pxPerDeg = ih / (top - bottom)

  const path = (pts: [number, number][]) => {
    let d = ''
    let prevX = NaN
    for (const [az, el] of pts) {
      const px = x(az)
      const py = y(Math.max(bottom, Math.min(top, el)))
      d += (Number.isNaN(prevX) || Math.abs(px - prevX) > iw / 2 ? 'M' : 'L') + px.toFixed(1) + ' ' + py.toFixed(1)
      prevX = px
    }
    return d
  }

  // Skyline polygon, ordered left to right in view coordinates.
  const sky = model.skyline
    .map(([az, el]) => [x(az), y(el)] as [number, number])
    .sort((a, b) => a[0] - b[0])
  const ground =
    `M${PAD.left} ${H - PAD.bottom}L${PAD.left} ${sky[0][1].toFixed(1)}` +
    sky.map(([px, py]) => `L${px.toFixed(1)} ${py.toFixed(1)}`).join('') +
    `L${W - PAD.right} ${sky[sky.length - 1][1].toFixed(1)}L${W - PAD.right} ${H - PAD.bottom}Z`

  const step = niceStep(top - bottom)
  const ticks: number[] = []
  for (let e = Math.ceil(bottom / step) * step; e <= top; e += step) ticks.push(e)
  const compassPts = [0, 45, 90, 135, 180, 225, 270, 315]
  const names: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }

  const sunR = Math.max(4, now.sun.radius * pxPerDeg)
  const earthR = Math.max(5, now.earth.radius * pxPerDeg)
  const inView = (el: number) => el > bottom && el < top

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    const py = e.clientY - r.top
    if (px < PAD.left || px > W - PAD.right || py < PAD.top || py > H - PAD.bottom) return setPointer(null)
    const az = ((((px - PAD.left) / iw) * 360 + centre - 180) % 360 + 360) % 360
    setPointer({ az, el: top - ((py - PAD.top) / ih) * (top - bottom) })
  }
  const skyAtPointer = pointer ? horizonElevation(site.horizon, pointer.az) : 0

  return (
    <div ref={ref} className="relative h-full w-full">
      <div
        className={`absolute right-0 top-0 z-10 gap-1 ${range ? 'hidden' : 'flex'}`}
        role="group"
        aria-label="Vertical range of the sky view"
      >
        {ZOOMS.map((z) => (
          <button
            key={z.id}
            className={`btn min-h-7! px-2! text-xs! ${zoom === z.id ? 'btn-primary' : ''}`}
            aria-pressed={zoom === z.id}
            onClick={() => setZoom(z.id)}
          >
            {z.label}
          </button>
        ))}
      </div>
      {pointer && (
        <div className="num pointer-events-none absolute left-11 top-0 z-10 rounded bg-black/70 px-2 py-1 text-xs text-ink">
          {compass(pointer.az)} {pointer.az.toFixed(0)}°, {pointer.el.toFixed(1)}° {pointer.el >= 0 ? 'up' : 'down'}
          <span className="text-muted">
            {' '}
            (skyline here {skyAtPointer.toFixed(2)}°: {pointer.el > skyAtPointer ? 'open sky' : 'behind terrain'})
          </span>
        </div>
      )}
      {width > 0 && (
        <svg
          width={W}
          height={H}
          onPointerMove={onMove}
          onPointerLeave={() => setPointer(null)}
          role="img"
          aria-label={`Sky at ${site.name}: Sun ${now.sun.el.toFixed(1)} degrees, Earth ${now.earth.el.toFixed(1)} degrees above the horizon`}
        >
          <defs>
            <clipPath id={`${uid}-clip`}>
              <rect x={PAD.left} y={PAD.top} width={iw} height={ih} />
            </clipPath>
            <linearGradient id={`${uid}-ground`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6b6862" />
              <stop offset="1" stopColor="#2b2a28" />
            </linearGradient>
          </defs>

          {ticks.map((e) => (
            <g key={e}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(e)} y2={y(e)} stroke="#2d313a" strokeWidth={e === 0 ? 0 : 1} />
              <text x={PAD.left - 8} y={y(e) + 4} textAnchor="end" fontSize="11" fill="#969aa3" className="num">
                {e}°
              </text>
            </g>
          ))}

          <g clipPath={`url(#${uid}-clip)`}>
            <path d={path(model.track.map((p) => p.sun))} fill="none" stroke="#f4c55a" strokeWidth="1.5" strokeDasharray="2 5" strokeLinecap="round" opacity="0.75" />
            <path d={path(model.track.map((p) => p.earth))} fill="none" stroke="#58a6e8" strokeWidth="1.5" opacity="0.7" />

            {inView(now.sun.el) && (
              <g>
                <circle cx={x(now.sun.az)} cy={y(now.sun.el)} r={sunR * 2.6} fill="#f4c55a" opacity="0.14" />
                <circle cx={x(now.sun.az)} cy={y(now.sun.el)} r={sunR} fill="#f4c55a" />
              </g>
            )}
            {inView(now.earth.el) && (
              <circle cx={x(now.earth.az)} cy={y(now.earth.el)} r={earthR} fill="#58a6e8" stroke="#bfe0fb" strokeWidth="1" />
            )}

            <path d={ground} fill={`url(#${uid}-ground)`} opacity="0.93" />
            <path
              d={'M' + sky.map(([px, py]) => `${px.toFixed(1)} ${py.toFixed(1)}`).join('L')}
              fill="none"
              stroke="#c9c5bc"
              strokeWidth="1.25"
            />
          </g>

          {pointer && (
            <line x1={x(pointer.az)} x2={x(pointer.az)} y1={PAD.top} y2={H - PAD.bottom} stroke="#969aa3" strokeWidth="1" strokeDasharray="3 3" />
          )}

          {compassPts.map((az) => (
            <text
              key={az}
              x={x(az)}
              y={H - 8}
              textAnchor="middle"
              fontSize="11"
              fill={az % 90 === 0 ? '#eceae4' : '#969aa3'}
            >
              {names[az]}
            </text>
          ))}
        </svg>
      )}
    </div>
  )
}
