import { useId, useMemo, useState, useRef, useCallback } from 'react'
import {
  horizonElevation,
  sphereHorizon,
  topo,
  type Site,
  type BodyView,
} from '../core'

const DEG = Math.PI / 180

export type PanoramaZoomMode = 'polar' | 'mid' | 'full' | 'custom'

interface PanoramaProps {
  site: Site
  t: number
  className?: string
}

interface TrackPoint {
  t: number
  az: number
  el: number
}

const LUNAR_DAY_MS = 29.530589 * 86400000
const TRACK_SAMPLES = 120

export function Panorama({ site, t, className = '' }: PanoramaProps) {
  const gradientId = useId()
  const [prevSiteId, setPrevSiteId] = useState(site.id)
  const [zoomMode, setZoomMode] = useState<PanoramaZoomMode>(() =>
    Math.abs(site.lat) >= 70 ? 'polar' : 'full',
  )
  if (prevSiteId !== site.id) {
    setPrevSiteId(site.id)
    setZoomMode(Math.abs(site.lat) >= 70 ? 'polar' : 'full')
  }

  const [customRange] = useState<[number, number]>([-3, 8])
  const [hoveredBody, setHoveredBody] = useState<'sun' | 'earth' | null>(null)
  const [mouseCoords, setMouseCoords] = useState<{ az: number; el: number; x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Determine elevation bounds based on zoom mode
  const [minEl, maxEl] = useMemo((): [number, number] => {
    switch (zoomMode) {
      case 'polar':
        return [-3, 7]
      case 'mid':
        return [-5, 25]
      case 'full':
        return [-10, 90]
      case 'custom':
        return customRange
    }
  }, [zoomMode, customRange])

  // Dimensions & Margins
  const viewBoxWidth = 1000
  const viewBoxHeight = 440
  const margin = { top: 32, right: 30, bottom: 44, left: 54 }
  const plotWidth = viewBoxWidth - margin.left - margin.right
  const plotHeight = viewBoxHeight - margin.top - margin.bottom

  // Coordinate transforms
  const azToX = useCallback(
    (az: number): number => {
      const normalizedAz = ((az % 360) + 360) % 360
      return margin.left + (normalizedAz / 360) * plotWidth
    },
    [margin.left, plotWidth],
  )

  const elToY = useCallback(
    (el: number): number => {
      const clamped = Math.max(minEl, Math.min(maxEl, el))
      const ratio = (clamped - minEl) / (maxEl - minEl)
      return margin.top + (1 - ratio) * plotHeight
    },
    [minEl, maxEl, margin.top, plotHeight],
  )

  const xToAz = useCallback(
    (x: number): number => {
      const ratio = (x - margin.left) / plotWidth
      return Math.max(0, Math.min(360, ratio * 360))
    },
    [margin.left, plotWidth],
  )

  const yToEl = useCallback(
    (y: number): number => {
      const ratio = (y - margin.top) / plotHeight
      return minEl + (1 - ratio) * (maxEl - minEl)
    },
    [minEl, maxEl, margin.top, plotHeight],
  )

  // Helper to convert track points to SVG paths, breaking across 360° wrapping
  const pointsToSvgPaths = useCallback(
    (points: TrackPoint[]): string[] => {
      const segments: string[] = []
      let currentSegment = ''

      for (let i = 0; i < points.length; i++) {
        const pt = points[i]
        const x = azToX(pt.az)
        const y = elToY(pt.el)

        if (i === 0) {
          currentSegment = `M ${x} ${y}`
        } else {
          const prev = points[i - 1]
          if (Math.abs(pt.az - prev.az) > 180) {
            segments.push(currentSegment)
            currentSegment = `M ${x} ${y}`
          } else {
            currentSegment += ` L ${x} ${y}`
          }
        }
      }
      if (currentSegment) {
        segments.push(currentSegment)
      }
      return segments
    },
    [azToX, elToY],
  )

  // Compute current celestial view
  const currentTopo = useMemo(() => topo(site, t), [site, t])

  // Precompute Sun and Earth tracks over the next lunar day (29.5 days)
  const { sunTrackPaths, earthTrackPaths } = useMemo(() => {
    const sunPoints: TrackPoint[] = []
    const earthPoints: TrackPoint[] = []
    const step = LUNAR_DAY_MS / TRACK_SAMPLES

    for (let i = 0; i <= TRACK_SAMPLES; i++) {
      const sampleT = t + i * step
      const v = topo(site, sampleT)
      sunPoints.push({ t: sampleT, az: v.sun.az, el: v.sun.el })
      earthPoints.push({ t: sampleT, az: v.earth.az, el: v.earth.el })
    }

    return {
      sunTrackPaths: pointsToSvgPaths(sunPoints),
      earthTrackPaths: pointsToSvgPaths(earthPoints),
    }
  }, [site, t, pointsToSvgPaths])

  // Generate terrain skyline profile
  const { terrainPath, terrainSkylinePath, hasTerrain } = useMemo(() => {
    const hasData = Boolean(site.horizon && site.horizon.elev_deg.length > 0)
    const points: [number, number][] = []
    const stepDeg = 1 // 1 degree sampling is smooth and lightweight

    for (let az = 0; az <= 360; az += stepDeg) {
      const el = hasData
        ? horizonElevation(site.horizon, az)
        : sphereHorizon(site.alt_m ? site.alt_m : 2)
      points.push([az, el])
    }

    // Skyline stroke path
    let skylineD = ''
    points.forEach(([az, el], i) => {
      const x = azToX(az)
      const y = elToY(el)
      skylineD += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`
    })

    // Filled terrain polygon
    const bottomY = margin.top + plotHeight
    const terrainD = `${skylineD} L ${margin.left + plotWidth} ${bottomY} L ${margin.left} ${bottomY} Z`

    return {
      terrainPath: terrainD,
      terrainSkylinePath: skylineD,
      hasTerrain: hasData,
    }
  }, [site, azToX, elToY, margin.top, margin.left, plotHeight, plotWidth])

  // Calculate pixel radius for Sun and Earth
  const scaleY = plotHeight / (maxEl - minEl)
  const scaleX = plotWidth / 360

  const getDiskPixels = (body: BodyView) => {
    const cosEl = Math.max(0.1, Math.cos(body.el * DEG))
    const rawRx = (body.radius / cosEl) * scaleX
    const rawRy = body.radius * scaleY
    // Keep true angular size as core disk, but ensure clickable halo
    const rx = Math.max(rawRx, 2.5)
    const ry = Math.max(rawRy, 2.5)
    return { rx, ry, rawRx, rawRy }
  }

  const sunPixels = getDiskPixels(currentTopo.sun)
  const earthPixels = getDiskPixels(currentTopo.earth)

  const sunX = azToX(currentTopo.sun.az)
  const sunY = elToY(currentTopo.sun.el)
  const earthX = azToX(currentTopo.earth.az)
  const earthY = elToY(currentTopo.earth.el)

  // Elevation ticks
  const elTicks = useMemo(() => {
    const range = maxEl - minEl
    let step = 1
    if (range > 40) step = 15
    else if (range > 15) step = 5
    else if (range > 8) step = 2
    else step = 1

    const ticks: number[] = []
    const start = Math.ceil(minEl / step) * step
    for (let v = start; v <= maxEl; v += step) {
      ticks.push(v)
    }
    return ticks
  }, [minEl, maxEl])

  // Cardinal directions along Azimuth
  const cardinalTicks = [
    { label: 'N', az: 0 },
    { label: 'NE', az: 45 },
    { label: 'E', az: 90 },
    { label: 'SE', az: 135 },
    { label: 'S', az: 180 },
    { label: 'SW', az: 225 },
    { label: 'W', az: 270 },
    { label: 'NW', az: 315 },
    { label: 'N', az: 360 },
  ]

  // Handle mouse move for interactive crosshair readout
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * viewBoxWidth
    const svgY = ((e.clientY - rect.top) / rect.height) * viewBoxHeight

    if (
      svgX >= margin.left &&
      svgX <= margin.left + plotWidth &&
      svgY >= margin.top &&
      svgY <= margin.top + plotHeight
    ) {
      setMouseCoords({
        az: xToAz(svgX),
        el: yToEl(svgY),
        x: svgX,
        y: svgY,
      })
    } else {
      setMouseCoords(null)
    }
  }

  return (
    <div className={`flex flex-col rounded-xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl backdrop-blur-sm ${className}`}>
      {/* Top Header & Zoom Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              Horizon Panorama
              <span className={`text-xs font-normal px-2 py-0.5 rounded-full border ${
                hasTerrain
                  ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                  : 'bg-slate-800/80 border-slate-700 text-slate-400'
              }`}>
                {hasTerrain ? 'LOLA DEM Terrain' : 'Smooth-Sphere Dip'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              360° skyline silhouette with true-scale Sun & Earth disks and 29.5-day orbital tracks
            </p>
          </div>
        </div>

        {/* Zoom Mode Selector */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-lg border border-slate-700/70 text-xs">
          <span className="text-slate-400 px-1 font-medium">Zoom:</span>
          <button
            onClick={() => setZoomMode('polar')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              zoomMode === 'polar'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
            title="Optimized for Polar sites (-3° to +7°)"
          >
            Polar (-3° to +7°)
          </button>
          <button
            onClick={() => setZoomMode('mid')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              zoomMode === 'mid'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
            title="Mid elevation range (-5° to +25°)"
          >
            Mid (-5° to +25°)
          </button>
          <button
            onClick={() => setZoomMode('full')}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              zoomMode === 'full'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
            }`}
            title="Full sky elevation (-10° to +90°)"
          >
            Full Sky (to +90°)
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative w-full overflow-hidden rounded-lg border border-slate-800/80 bg-slate-950">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-auto select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setMouseCoords(null)}
        >
          <defs>
            {/* Deep space sky gradient */}
            <linearGradient id={`${gradientId}-sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#020308" />
              <stop offset="60%" stopColor="#050812" />
              <stop offset="100%" stopColor="#0b101d" />
            </linearGradient>

            {/* Terrain gradient */}
            <linearGradient id={`${gradientId}-terrain`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#181d27" />
              <stop offset="40%" stopColor="#10141c" />
              <stop offset="100%" stopColor="#07090e" />
            </linearGradient>

            {/* Sun Corona glow */}
            <radialGradient id={`${gradientId}-sun-glow`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
            </radialGradient>

            {/* Earth atmosphere glow */}
            <radialGradient id={`${gradientId}-earth-glow`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#0284c7" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0" />
            </radialGradient>

            {/* Clip path for plot area */}
            <clipPath id={`${gradientId}-plot-clip`}>
              <rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} />
            </clipPath>
          </defs>

          {/* Background Sky */}
          <rect
            x={margin.left}
            y={margin.top}
            width={plotWidth}
            height={plotHeight}
            fill={`url(#${gradientId}-sky)`}
          />

          {/* Grid lines and background markings (clipped) */}
          <g clipPath={`url(#${gradientId}-plot-clip)`}>
            {/* Elevation horizontal grid lines */}
            {elTicks.map((el) => {
              const y = elToY(el)
              const isZero = Math.abs(el) < 0.001
              return (
                <g key={`el-${el}`}>
                  <line
                    x1={margin.left}
                    y1={y}
                    x2={margin.left + plotWidth}
                    y2={y}
                    stroke={isZero ? '#64748b' : '#1e293b'}
                    strokeWidth={isZero ? 1.5 : 1}
                    strokeDasharray={isZero ? '6 4' : '3 3'}
                  />
                  {isZero && (
                    <text
                      x={margin.left + 6}
                      y={y - 4}
                      fill="#94a3b8"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      0° Astronomical Horizon
                    </text>
                  )}
                </g>
              )
            })}

            {/* Azimuth vertical grid lines */}
            {cardinalTicks.map(({ az }) => {
              const x = azToX(az)
              return (
                <line
                  key={`az-${az}`}
                  x1={x}
                  y1={margin.top}
                  x2={x}
                  y2={margin.top + plotHeight}
                  stroke="#1e293b"
                  strokeWidth={1}
                  strokeDasharray="2 4"
                />
              )
            })}

            {/* Sun Track Paths (Next 29.5 Days) */}
            {sunTrackPaths.map((d, idx) => (
              <path
                key={`sun-track-${idx}`}
                d={d}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                strokeOpacity={0.65}
              />
            ))}

            {/* Earth Track Paths (Next 29.5 Days) */}
            {earthTrackPaths.map((d, idx) => (
              <path
                key={`earth-track-${idx}`}
                d={d}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                strokeOpacity={0.7}
              />
            ))}

            {/* Sub-terrain faint indicator rings (if celestial body is below skyline) */}
            {currentTopo.sun.el < currentTopo.sun.horizonEl && (
              <g opacity={0.4}>
                <ellipse
                  cx={sunX}
                  cy={sunY}
                  rx={sunPixels.rx}
                  ry={sunPixels.ry}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
                <circle cx={sunX} cy={sunY} r={2} fill="#f59e0b" />
              </g>
            )}

            {currentTopo.earth.el < currentTopo.earth.horizonEl && (
              <g opacity={0.4}>
                <ellipse
                  cx={earthX}
                  cy={earthY}
                  rx={earthPixels.rx}
                  ry={earthPixels.ry}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
                <circle cx={earthX} cy={earthY} r={2} fill="#38bdf8" />
              </g>
            )}

            {/* Sun Disk & Glow (at true angular scale) */}
            <g
              className="cursor-pointer transition-transform"
              onMouseEnter={() => setHoveredBody('sun')}
              onMouseLeave={() => setHoveredBody(null)}
            >
              {/* Corona outer glow */}
              <circle
                cx={sunX}
                cy={sunY}
                r={Math.max(sunPixels.ry * 2.8, 14)}
                fill={`url(#${gradientId}-sun-glow)`}
                opacity={currentTopo.sun.visibleFraction > 0 ? 0.75 : 0.2}
              />
              {/* True Angular Disk */}
              <ellipse
                cx={sunX}
                cy={sunY}
                rx={sunPixels.rx}
                ry={sunPixels.ry}
                fill="#fef08a"
                stroke="#f59e0b"
                strokeWidth={1}
              />
              {/* Pointer indicator ring if zoomed far out */}
              {sunPixels.ry < 6 && (
                <circle
                  cx={sunX}
                  cy={sunY}
                  r={8}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                />
              )}
            </g>

            {/* Earth Disk & Glow (at true angular scale) */}
            <g
              className="cursor-pointer transition-transform"
              onMouseEnter={() => setHoveredBody('earth')}
              onMouseLeave={() => setHoveredBody(null)}
            >
              {/* Earth atmosphere glow */}
              <circle
                cx={earthX}
                cy={earthY}
                r={Math.max(earthPixels.ry * 2.2, 14)}
                fill={`url(#${gradientId}-earth-glow)`}
                opacity={currentTopo.earth.visible ? 0.7 : 0.25}
              />
              {/* True Angular Earth Disk */}
              <ellipse
                cx={earthX}
                cy={earthY}
                rx={earthPixels.rx}
                ry={earthPixels.ry}
                fill="#0284c7"
                stroke="#38bdf8"
                strokeWidth={1.2}
              />
              {/* Visual continental swirl */}
              <ellipse
                cx={earthX - earthPixels.rx * 0.2}
                cy={earthY - earthPixels.ry * 0.15}
                rx={earthPixels.rx * 0.45}
                ry={earthPixels.ry * 0.35}
                fill="#38bdf8"
                opacity={0.65}
              />
              {/* Outer ring */}
              <circle
                cx={earthX}
                cy={earthY}
                r={Math.max(earthPixels.ry + 2, 7)}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={1}
                strokeDasharray="3 2"
                opacity={0.8}
              />
            </g>

            {/* Terrain Silhouette Polygon on Foreground (Occludes Celestial Bodies) */}
            <path
              d={terrainPath}
              fill={`url(#${gradientId}-terrain)`}
            />

            {/* Highlighted Terrain Skyline Stroke */}
            <path
              d={terrainSkylinePath}
              fill="none"
              stroke="#64748b"
              strokeWidth={1.5}
            />

            {/* Current Position Callout Pins */}
            {/* Sun Callout */}
            <g transform={`translate(${sunX}, ${Math.max(margin.top + 16, Math.min(plotHeight + margin.top - 16, sunY - 14))})`}>
              <line x1={0} y1={-8} x2={0} y2={-2} stroke="#f59e0b" strokeWidth={1} />
              <rect x={-20} y={-24} width={40} height={16} rx={4} fill="#0f172a" stroke="#f59e0b" strokeWidth={1} />
              <text x={0} y={-13} textAnchor="middle" fill="#fde047" fontSize="9" fontWeight="bold">
                ☀ Sun
              </text>
            </g>

            {/* Earth Callout */}
            <g transform={`translate(${earthX}, ${Math.max(margin.top + 16, Math.min(plotHeight + margin.top - 16, earthY - 14))})`}>
              <line x1={0} y1={-8} x2={0} y2={-2} stroke="#38bdf8" strokeWidth={1} />
              <rect x={-24} y={-24} width={48} height={16} rx={4} fill="#0f172a" stroke="#38bdf8" strokeWidth={1} />
              <text x={0} y={-13} textAnchor="middle" fill="#7dd3fc" fontSize="9" fontWeight="bold">
                ⊕ Earth
              </text>
            </g>

            {/* Mouse Crosshairs on Hover */}
            {mouseCoords && (
              <g pointerEvents="none">
                <line
                  x1={mouseCoords.x}
                  y1={margin.top}
                  x2={mouseCoords.x}
                  y2={margin.top + plotHeight}
                  stroke="#94a3b8"
                  strokeWidth={0.8}
                  strokeDasharray="2 2"
                />
                <line
                  x1={margin.left}
                  y1={mouseCoords.y}
                  x2={margin.left + plotWidth}
                  y2={mouseCoords.y}
                  stroke="#94a3b8"
                  strokeWidth={0.8}
                  strokeDasharray="2 2"
                />
                {/* Crosshair readout badge */}
                <rect
                  x={Math.min(margin.left + plotWidth - 110, mouseCoords.x + 8)}
                  y={Math.max(margin.top + 4, mouseCoords.y - 28)}
                  width={100}
                  height={22}
                  rx={4}
                  fill="#020617"
                  stroke="#475569"
                  strokeWidth={1}
                />
                <text
                  x={Math.min(margin.left + plotWidth - 110, mouseCoords.x + 8) + 6}
                  y={Math.max(margin.top + 4, mouseCoords.y - 28) + 15}
                  fill="#f1f5f9"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {mouseCoords.az.toFixed(1)}° · {mouseCoords.el >= 0 ? '+' : ''}{mouseCoords.el.toFixed(1)}°
                </text>
              </g>
            )}
          </g>

          {/* Elevation Axis Y (Left) */}
          <g>
            <line
              x1={margin.left}
              y1={margin.top}
              x2={margin.left}
              y2={margin.top + plotHeight}
              stroke="#334155"
              strokeWidth={1}
            />
            {elTicks.map((el) => {
              const y = elToY(el)
              return (
                <g key={`y-axis-${el}`}>
                  <line x1={margin.left - 5} y1={y} x2={margin.left} y2={y} stroke="#64748b" strokeWidth={1} />
                  <text
                    x={margin.left - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill="#94a3b8"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {el >= 0 ? `+${el}°` : `${el}°`}
                  </text>
                </g>
              )
            })}
            {/* Axis title */}
            <text
              transform={`rotate(-90)`}
              x={-(margin.top + plotHeight / 2)}
              y={14}
              textAnchor="middle"
              fill="#64748b"
              fontSize="10"
              fontWeight="medium"
              letterSpacing="0.05em"
            >
              ELEVATION (DEG)
            </text>
          </g>

          {/* Azimuth Axis X (Bottom) */}
          <g>
            <line
              x1={margin.left}
              y1={margin.top + plotHeight}
              x2={margin.left + plotWidth}
              y2={margin.top + plotHeight}
              stroke="#334155"
              strokeWidth={1}
            />
            {cardinalTicks.map(({ label, az }) => {
              const x = azToX(az)
              const isMajor = az % 90 === 0
              return (
                <g key={`x-axis-${az}-${label}`}>
                  <line
                    x1={x}
                    y1={margin.top + plotHeight}
                    x2={x}
                    y2={margin.top + plotHeight + 5}
                    stroke="#64748b"
                    strokeWidth={1}
                  />
                  <text
                    x={x}
                    y={margin.top + plotHeight + 17}
                    textAnchor="middle"
                    fill={isMajor ? '#f1f5f9' : '#94a3b8'}
                    fontSize={isMajor ? '11' : '10'}
                    fontWeight={isMajor ? 'bold' : 'normal'}
                  >
                    {label}
                  </text>
                  <text
                    x={x}
                    y={margin.top + plotHeight + 28}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="8.5"
                    fontFamily="monospace"
                  >
                    {az}°
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Hover inspection detail cards */}
        {hoveredBody && (
          <div className="absolute top-3 left-16 z-20 rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md">
            {hoveredBody === 'sun' && (
              <div>
                <div className="font-semibold text-amber-300 flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  Sun Telemetry
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-300">
                  <div>Azimuth: <span className="font-mono text-white">{currentTopo.sun.az.toFixed(2)}°</span></div>
                  <div>Elevation: <span className="font-mono text-white">{currentTopo.sun.el.toFixed(2)}°</span></div>
                  <div>Terrain Skyline: <span className="font-mono text-white">{currentTopo.sun.horizonEl.toFixed(2)}°</span></div>
                  <div>Lit Disk: <span className="font-mono text-white">{(currentTopo.sun.visibleFraction * 100).toFixed(1)}%</span></div>
                  <div className="col-span-2">Radius: <span className="font-mono text-white">{currentTopo.sun.radius.toFixed(3)}°</span> ({(currentTopo.sun.distance_km / 1e6).toFixed(1)}M km)</div>
                </div>
              </div>
            )}
            {hoveredBody === 'earth' && (
              <div>
                <div className="font-semibold text-sky-300 flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  Earth & DTE Telemetry
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-slate-300">
                  <div>Azimuth: <span className="font-mono text-white">{currentTopo.earth.az.toFixed(2)}°</span></div>
                  <div>Elevation: <span className="font-mono text-white">{currentTopo.earth.el.toFixed(2)}°</span></div>
                  <div>Terrain Skyline: <span className="font-mono text-white">{currentTopo.earth.horizonEl.toFixed(2)}°</span></div>
                  <div>DTE Link: <span className={`font-mono font-medium ${currentTopo.earth.visible ? 'text-emerald-400' : 'text-rose-400'}`}>{currentTopo.earth.visible ? 'Available' : 'Occluded'}</span></div>
                  <div className="col-span-2">Radius: <span className="font-mono text-white">{currentTopo.earth.radius.toFixed(3)}°</span> ({(currentTopo.earth.distance_km).toLocaleString()} km)</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend & Telemetry Quick Summary */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 px-1">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"></span>
            <span>Sun Disk ({(currentTopo.sun.radius * 2).toFixed(2)}° diam)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.5)]"></span>
            <span>Earth Disk ({(currentTopo.earth.radius * 2).toFixed(2)}° diam)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-amber-400 border-b border-dashed border-amber-300"></span>
            <span className="text-slate-400">Sun 29.5d Track</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-sky-400 border-b border-dotted border-sky-300"></span>
            <span className="text-slate-400">Earth Libration Track</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-2 rounded-sm bg-slate-800 border-t border-slate-500"></span>
            <span className="text-slate-400">Lunar Terrain Skyline</span>
          </div>
        </div>

        <div className="text-slate-400">
          Tip: Hover over disks for coordinates; hover over sky for crosshair.
        </div>
      </div>
    </div>
  )
}
