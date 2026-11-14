export const HOUR = 3600000
export const DAY = 86400000

/** "3 d 4 h", "5 h 12 min", "8 min". */
export function duration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000))
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  if (d >= 1) return `${d} d ${h} h`
  if (h >= 1) return `${h} h ${m} min`
  return `${m} min`
}

export function deg(x: number, digits = 1): string {
  return `${x.toFixed(digits)}°`
}

const DATE = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const DATE_SHORT = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hour12: false })

export const dateUTC = (t: number) => DATE.format(t)
export const dateShortUTC = (t: number) => DATE_SHORT.format(t)
export const timeUTC = (t: number) => TIME.format(t)

/** Value for <input type="datetime-local">, read as UTC. */
export const toInputValue = (t: number) => new Date(t).toISOString().slice(0, 16)
export const fromInputValue = (v: string) => Date.parse(`${v}:00Z`)

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
export const compass = (az: number) => COMPASS[Math.round((((az % 360) + 360) % 360) / 22.5) % 16]

export function latLon(lat: number, lon: number): string {
  const l = ((((lon + 180) % 360) + 360) % 360) - 180
  return `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(l).toFixed(2)}° ${l >= 0 ? 'E' : 'W'}`
}
