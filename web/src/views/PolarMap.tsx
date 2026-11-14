import { useEffect, useMemo, useRef, useState } from 'react'
import {
  gridHorizon,
  loadPolarGrid,
  scoreGrid,
  type HorizonProfile,
  type PolarGrid,
  type Site,
  type TerrainPatch,
} from '../core'
import { HOUR, latLon } from '../lib/format'
import { useSize } from '../lib/useSize'
import MoonLoader from './MoonLoader'

/**
 * The whole south polar region scored cell by cell for the chosen date, using each cell's own terrain
 * skyline. Steep cells are screened out. Click a cell to open it as a landing point.
 */

interface Props {
  sites: Site[]
  t: number
  days: number
  weights: [number, number, number]
  current: Site
  onPick: (lat: number, lon: number, horizon: HorizonProfile, terrain?: TerrainPatch) => void
}

const R_KM = 1737.4
const DEG = Math.PI / 180
const SLOPE_LIMITS = [10, 15, 20, 90]
const STEEP_FILL = '#23262d'

// Sequential ramp, dark to bright, in the page's sunlight hue.
const RAMP: [number, number, number][] = [
  [29, 32, 39],
  [78, 62, 36],
  [150, 108, 40],
  [244, 197, 90],
  [255, 244, 214],
]
function ramp(v: number): string {
  const x = Math.min(Math.max(v, 0), 1) * (RAMP.length - 1)
  const i = Math.min(Math.floor(x), RAMP.length - 2)
  const f = x - i
  const c = RAMP[i].map((a, k) => Math.round(a + (RAMP[i + 1][k] - a) * f))
  return `rgb(${c[0]},${c[1]},${c[2]})`
}

/** South polar stereographic, km. Longitude 0 (the Earth-facing side) is up, east is to the right. */
function project(lat: number, lon: number): [number, number] {
  const r = 2 * R_KM * Math.tan(((90 + lat) * DEG) / 2)
  return [r * Math.sin(lon * DEG), r * Math.cos(lon * DEG)]
}

export default function PolarMap({ sites, t, days, weights, current, onPick }: Props) {
  const [grid, setGrid] = useState<PolarGrid | null>(null)
  const [error, setError] = useState('')
  const [limitIdx, setLimitIdx] = useState(1)
  const [hover, setHover] = useState<number | null>(null)
  const [wrapRef, { width }] = useSize<HTMLDivElement>()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    loadPolarGrid().then(setGrid, (e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const tHour = Math.round(t / HOUR) * HOUR
  const scores = useMemo(() => (grid ? scoreGrid(grid, tHour, days, weights) : null), [grid, tHour, days, weights])

  // Grid geometry: cell centres sit on a regular lattice in projected km.
  const geo = useMemo(() => {
    if (!grid) return null
    const rMax = 2 * R_KM * Math.tan(((90 + grid.latMax) * DEG) / 2)
    const half = Math.floor(rMax / grid.spacingKm)
    const side = 2 * half + 1
    const index = new Int32Array(side * side).fill(-1)
    for (let i = 0; i < grid.n; i++) {
      const [x, y] = project(grid.lat[i], grid.lon[i])
      const ix = Math.round(x / grid.spacingKm) + half
      const iy = Math.round(y / grid.spacingKm) + half
      index[iy * side + ix] = i
    }
    return { rMax, half, side, index }
  }, [grid])

  const slopeLimit = SLOPE_LIMITS[limitIdx]
  const steep = (i: number) => grid !== null && grid.slope[i] * grid.slopeUnit > slopeLimit

  // Best cells: highest scores on gentle ground, at least 20 km apart so they are distinct places.
  const best = useMemo(() => {
    if (!grid || !scores) return []
    const order = Array.from({ length: grid.n }, (_, i) => i)
      .filter((i) => grid.slope[i] * grid.slopeUnit <= slopeLimit)
      .sort((a, b) => scores.litAtArrival[b] - scores.litAtArrival[a] || scores.score[b] - scores.score[a])
    const picked: number[] = []
    for (const i of order) {
      const [x, y] = project(grid.lat[i], grid.lon[i])
      if (picked.every((p) => {
        const [px, py] = project(grid.lat[p], grid.lon[p])
        return Math.hypot(px - x, py - y) >= 20
      })) picked.push(i)
      if (picked.length === 5) break
    }
    return picked
  }, [grid, scores, slopeLimit])

  const size = Math.max(240, Math.min(width || 320, 560))
  const toPx = (xKm: number, yKm: number): [number, number] => {
    const s = size / (2 * (geo?.rMax ?? 1))
    return [size / 2 + xKm * s, size / 2 - yKm * s]
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !grid || !scores || !geo) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = size * dpr
    canvas.height = size * dpr
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    const cell = (grid.spacingKm * size) / (2 * geo.rMax)
    for (let i = 0; i < grid.n; i++) {
      const [x, y] = project(grid.lat[i], grid.lon[i])
      const [px, py] = toPx(x, y)
      ctx.fillStyle = grid.slope[i] * grid.slopeUnit > slopeLimit ? STEEP_FILL : ramp(scores.score[i] / 100)
      ctx.fillRect(px - cell / 2, py - cell / 2, cell + 0.6, cell + 0.6)
    }
    // Graticule
    ctx.strokeStyle = 'rgba(236,234,228,0.28)'
    ctx.fillStyle = 'rgba(236,234,228,0.8)'
    ctx.lineWidth = 1
    ctx.font = '11px Archivo, sans-serif'
    for (const lat of [-88, -86, -84]) {
      if (lat > grid.latMax) continue
      const rPx = (project(lat, 0)[1] * size) / (2 * geo.rMax)
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, rPx, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillText(`${-lat}°S`, size / 2 + rPx * 0.7071 + 3, size / 2 + rPx * 0.7071 + 11)
    }
    for (const [lon, label] of [[0, '0° (toward Earth)'], [90, '90°E'], [180, '180°'], [270, '90°W']] as const) {
      const [ex, ey] = toPx(...project(grid.latMax, lon))
      ctx.beginPath()
      ctx.moveTo(size / 2, size / 2)
      ctx.lineTo(ex, ey)
      ctx.stroke()
      ctx.textAlign = lon === 90 ? 'right' : lon === 270 ? 'left' : 'center'
      ctx.fillText(label, lon === 90 ? ex - 4 : lon === 270 ? ex + 4 : ex, lon === 0 ? ey + 13 : lon === 180 ? ey - 5 : ey - 5)
    }
    ctx.textAlign = 'left'
    // Named sites
    for (const s of sites) {
      if (s.lat > grid.latMax) continue
      const [px, py] = toPx(...project(s.lat, s.lon))
      ctx.beginPath()
      ctx.arc(px, py, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = '#000'
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    // Best cells, numbered
    best.forEach((i, rank) => {
      const [px, py] = toPx(...project(grid.lat[i], grid.lon[i]))
      ctx.beginPath()
      ctx.arc(px, py, 8, 0, Math.PI * 2)
      ctx.fillStyle = '#58a6e8'
      ctx.fill()
      ctx.fillStyle = '#000'
      ctx.font = 'bold 11px Archivo, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(rank + 1), px, py + 4)
      ctx.textAlign = 'left'
    })
    // The point currently open
    if (current.lat <= grid.latMax) {
      const [px, py] = toPx(...project(current.lat, current.lon))
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(px - 10, py)
      ctx.lineTo(px - 4, py)
      ctx.moveTo(px + 4, py)
      ctx.lineTo(px + 10, py)
      ctx.moveTo(px, py - 10)
      ctx.lineTo(px, py - 4)
      ctx.moveTo(px, py + 4)
      ctx.lineTo(px, py + 10)
      ctx.stroke()
    }
  }, [grid, scores, geo, size, slopeLimit, sites, best, current.lat, current.lon]) // eslint-disable-line react-hooks/exhaustive-deps

  const cellAt = (e: React.MouseEvent<HTMLCanvasElement>): number | null => {
    if (!grid || !geo) return null
    const r = e.currentTarget.getBoundingClientRect()
    const xKm = ((e.clientX - r.left - size / 2) / size) * 2 * geo.rMax
    const yKm = ((size / 2 - (e.clientY - r.top)) / size) * 2 * geo.rMax
    const ix = Math.round(xKm / grid.spacingKm) + geo.half
    const iy = Math.round(yKm / grid.spacingKm) + geo.half
    if (ix < 0 || iy < 0 || ix >= geo.side || iy >= geo.side) return null
    const i = geo.index[iy * geo.side + ix]
    return i >= 0 ? i : null
  }
  /**
   * A block of terrain around a grid cell for the landscape view, built from the cells around it.
   * Coarse (one height per 4 km cell) but real, and aligned to local east and north like the named sites' blocks.
   */
  const patchAround = (i: number): TerrainPatch | undefined => {
    if (!grid || !geo) return undefined
    const n = 17
    const widthKm = (n - 1) * grid.spacingKm
    const lat0 = grid.lat[i] * DEG
    const lon0 = grid.lon[i] * DEG
    const heights = new Int16Array(n * n)
    let low = Infinity
    let high = -Infinity
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const east = (col / (n - 1) - 0.5) * widthKm
        const north = (0.5 - row / (n - 1)) * widthKm
        // Great-circle step from the cell by (east, north).
        const d = Math.hypot(east, north) / R_KM
        const az = Math.atan2(east, north)
        const sinLat = Math.sin(lat0) * Math.cos(d) + Math.cos(lat0) * Math.sin(d) * Math.cos(az)
        const lat = Math.asin(Math.min(1, Math.max(-1, sinLat)))
        const lon = lon0 + Math.atan2(Math.sin(az) * Math.sin(d) * Math.cos(lat0), Math.cos(d) - Math.sin(lat0) * sinLat)
        const [x, y] = project(lat / DEG, lon / DEG)
        const ix = Math.round(x / grid.spacingKm) + geo.half
        const iy = Math.round(y / grid.spacingKm) + geo.half
        const k = ix >= 0 && iy >= 0 && ix < geo.side && iy < geo.side ? geo.index[iy * geo.side + ix] : -1
        const h = k >= 0 ? grid.height[k] : grid.height[i]
        heights[row * n + col] = h
        if (Math.hypot(east, north) <= 10) {
          low = Math.min(low, h)
          high = Math.max(high, h)
        }
      }
    }
    return {
      n,
      width_km: widthKm,
      heights,
      spacing_m: grid.spacingKm * 1000,
      resolution_m: grid.spacingKm * 1000,
      height_m: grid.height[i],
      slope_deg: grid.slope[i] * grid.slopeUnit,
      slope_baseline_m: 160,
      low_10km_m: low,
      high_10km_m: high,
    }
  }
  const open = (i: number) => grid && onPick(grid.lat[i], grid.lon[i], gridHorizon(grid, i), patchAround(i))

  // The wrapper below must exist on the first render so its width can be measured.
  if (error || !grid || !scores) {
    return (
      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,560px)_1fr]">
        <div ref={wrapRef}>
          {error ? (
            <p className="text-sm text-warn">{error}. Reload the page to try again.</p>
          ) : (
            <div className="grid h-60 place-items-center">
              <MoonLoader label="Loading the south-pole terrain grid…" />
            </div>
          )}
        </div>
      </div>
    )
  }

  const describe = (i: number) =>
    `${latLon(grid.lat[i], grid.lon[i])}: score ${scores.score[i].toFixed(0)}, sunlight ${scores.solar[i].toFixed(0)}%, Earth in view ${scores.dte[i].toFixed(0)}%, slope ${(grid.slope[i] * grid.slopeUnit).toFixed(1)}°, height ${grid.height[i]} m`

  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,560px)_1fr]">
      <div ref={wrapRef}>
        <canvas
          data-tour="polar-map"
          ref={canvasRef}
          style={{ width: size, height: size }}
          className="cursor-crosshair rounded-lg"
          role="img"
          aria-label={`Map of the lunar south pole south of ${-grid.latMax} degrees, coloured by landing score for the chosen date`}
          onPointerMove={(e) => setHover(cellAt(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const i = cellAt(e)
            if (i !== null) open(i)
          }}
        />
        <p className="num mt-2 min-h-8 text-xs text-muted" aria-live="polite">
          {hover !== null
            ? `${describe(hover)}${steep(hover) ? '. Too steep at the current limit.' : ''}`
            : 'Point at the map to read a cell. Click to open that point with its terrain skyline.'}
        </p>
      </div>

      <div className="text-sm">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>Low score</span>
          <span
            className="h-2.5 w-40 rounded-full"
            style={{ background: `linear-gradient(to right, ${[0, 0.25, 0.5, 0.75, 1].map(ramp).join(',')})` }}
          />
          <span>High</span>
          <span className="ml-3 inline-block h-2.5 w-4 rounded-sm" style={{ background: STEEP_FILL, outline: '1px solid #454a56' }} />
          <span>Too steep</span>
        </div>

        <label className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          Leave out ground steeper than
          <select className="field min-h-8!" value={limitIdx} onChange={(e) => setLimitIdx(Number(e.target.value))}>
            {SLOPE_LIMITS.map((s, i) => (
              <option key={s} value={i}>
                {s === 90 ? 'no limit' : `${s}°`}
              </option>
            ))}
          </select>
        </label>

        <h3 className="mt-5 text-sm font-medium">Best areas on this date</h3>
        {best.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No cell passes the slope limit. Raise the limit to see candidates.</p>
        ) : (
          <ol className="mt-2 space-y-2">
            {best.map((i, rank) => (
              <li key={i} className="flex items-center justify-between gap-3 border-b border-line/60 pb-2">
                <div>
                  <div className="num">
                    <span className="mr-2 inline-grid h-5 w-5 place-items-center rounded-full bg-earth text-xs font-semibold text-black">
                      {rank + 1}
                    </span>
                    {latLon(grid.lat[i], grid.lon[i])}
                  </div>
                  <div className="num mt-0.5 text-xs text-muted">
                    Score {scores.score[i].toFixed(0)}: sunlight {scores.solar[i].toFixed(0)}%, Earth in view{' '}
                    {scores.dte[i].toFixed(0)}%, slope {(grid.slope[i] * grid.slopeUnit).toFixed(1)}°
                    {scores.litAtArrival[i] ? '' : ', dark on arrival'}
                  </div>
                </div>
                <button className="btn" onClick={() => open(i)}>
                  Open
                </button>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-4 text-xs leading-relaxed text-muted">
          {grid.n.toLocaleString('en-GB')} cells of {grid.spacingKm} km, south of {-grid.latMax}°S. Each cell has its own
          terrain skyline from LOLA elevation data, so crater floors score as dark and ridges as bright. White rings are
          the named sites. The slope is the average inside the cell: it screens out crater walls and steep flanks, but it
          cannot see rocks or small craters, so a high score here marks an area worth studying, not a place proven safe
          to land.
        </p>
      </div>
    </div>
  )
}
