import type { Site } from '../core'
import { compass } from '../lib/format'

/**
 * What the ground is like at the selected point: height, slope, how rugged the surroundings are,
 * and where the skyline is highest and lowest. Shown on the 3D panel when a point is selected.
 * It describes the terrain; it does not say whether it is safe to land on.
 */

const metres = (v: number) => `${Math.abs(Math.round(v)).toLocaleString('en-GB')} m`

function slopeWord(deg: number): string {
  if (deg < 3) return 'nearly level'
  if (deg < 8) return 'gentle'
  if (deg < 15) return 'moderate'
  if (deg < 25) return 'steep'
  return 'very steep'
}

export default function TerrainCard({
  site,
  inLandscape,
  onLandscape,
}: {
  site: Site
  inLandscape: boolean
  onLandscape: () => void
}) {
  const t = site.terrain
  const h = site.horizon

  let skyline: string | null = null
  if (h && h.elev_deg.length > 0) {
    let hi = 0
    let lo = 0
    h.elev_deg.forEach((v, i) => {
      if (v > h.elev_deg[hi]) hi = i
      if (v < h.elev_deg[lo]) lo = i
    })
    skyline = `up to ${h.elev_deg[hi].toFixed(1)}° toward ${compass(hi * h.az_step_deg)}, down to ${h.elev_deg[lo].toFixed(1)}° toward ${compass(lo * h.az_step_deg)}`
  }

  if (!t && !skyline) {
    return (
      <div className="pointer-events-auto max-w-xs self-end rounded-lg border border-line bg-black/70 p-3 text-xs text-muted backdrop-blur-sm">
        No terrain data for this point. Named sites have it, and so does any cell picked on the south-pole map.
      </div>
    )
  }

  const model = t ? (t.resolution_m >= 1000 ? `${(t.resolution_m / 1000).toFixed(1)} km` : `${t.resolution_m} m`) : null

  return (
    <div className="pointer-events-auto max-w-[19rem] self-end rounded-lg border border-line bg-black/70 p-3 text-xs backdrop-blur-sm">
      <h3 className="text-sm font-medium text-ink">The ground here</h3>
      <dl className="mt-2 hidden grid-cols-[auto_1fr] gap-x-3 gap-y-1 sm:grid">
        {t && (
          <>
            <dt className="text-muted">Height</dt>
            <dd className="num text-ink">
              {metres(t.height_m)} {t.height_m >= 0 ? 'above' : 'below'} the Moon's average surface
            </dd>
            <dt className="text-muted">Slope</dt>
            <dd className="num text-ink">
              {t.slope_deg.toFixed(1)}°, {slopeWord(t.slope_deg)}
              <span className="text-muted"> (measured over {metres(t.slope_baseline_m)})</span>
            </dd>
            <dt className="text-muted">Within 10 km</dt>
            <dd className="num text-ink">
              {metres(t.high_10km_m - t.low_10km_m)} between the lowest and highest ground
            </dd>
          </>
        )}
        {skyline && (
          <>
            <dt className="text-muted">Skyline</dt>
            <dd className="num text-ink">{skyline}</dd>
          </>
        )}
      </dl>
      {t && (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted">LOLA elevation data, {model} model</span>
          {!inLandscape && (
            <button className="btn btn-primary min-h-7! px-2.5! text-xs!" onClick={onLandscape}>
              See the landscape in 3D
            </button>
          )}
        </div>
      )}
    </div>
  )
}
