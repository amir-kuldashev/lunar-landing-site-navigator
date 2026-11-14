import type { Site } from '../core'

/**
 * The current view as a shareable link: site (or custom point), time, and pinned scenarios.
 *   ?site=im-2&t=2027-01-01T00:00&pins=im-2@2027-01-01T00:00~c:-85,30@2027-02-01T12:00
 */

export interface Pin {
  site: Site
  t: number
}

export interface UrlState {
  siteId?: string
  custom?: { lat: number; lon: number }
  t?: number
  pins: { siteId?: string; custom?: { lat: number; lon: number }; t: number }[]
}

const iso = (t: number) => new Date(t).toISOString().slice(0, 16)
const parseTime = (v: string | null) => {
  // Strict format only: Date.parse accepts surprising strings.
  if (!v || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return undefined
  const t = Date.parse(`${v}:00Z`)
  return Number.isFinite(t) ? t : undefined
}
const parsePoint = (v: string | null) => {
  if (!v) return undefined
  const [lat, lon] = v.split(',').map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || lon < -180 || lon > 360) return undefined
  return { lat, lon }
}

export function readUrlState(search = window.location.search): UrlState {
  const q = new URLSearchParams(search)
  const pins: UrlState['pins'] = []
  for (const part of (q.get('pins') ?? '').split('~')) {
    const [where, when] = part.split('@')
    const t = parseTime(when ?? null)
    if (!where || t === undefined) continue
    if (where.startsWith('c:')) {
      const custom = parsePoint(where.slice(2))
      if (custom) pins.push({ custom, t })
    } else pins.push({ siteId: where, t })
  }
  return { siteId: q.get('site') ?? undefined, custom: parsePoint(q.get('at')), t: parseTime(q.get('t')), pins: pins.slice(0, 6) }
}

export function buildUrl(site: Site, t: number, pins: Pin[]): string {
  const where = (s: Site) => (s.id === 'custom' ? `c:${s.lat},${s.lon}` : s.id)
  const q = new URLSearchParams()
  if (site.id === 'custom') q.set('at', `${site.lat},${site.lon}`)
  else q.set('site', site.id)
  q.set('t', iso(t))
  if (pins.length) q.set('pins', pins.map((p) => `${where(p.site)}@${iso(p.t)}`).join('~'))
  // Keep the separators readable; they are safe in a query string.
  const query = q.toString().replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%40/g, '@').replace(/%7E/g, '~')
  return `${window.location.origin}${window.location.pathname}?${query}`
}
