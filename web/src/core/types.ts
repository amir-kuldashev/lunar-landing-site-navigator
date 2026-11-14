/** Shared types for the core astronomy module. Angles are degrees, distances km, times ms since Unix epoch (UTC). */

export type Vec3 = [number, number, number]

/** Terrain horizon around a site: elevation angle of the skyline per azimuth (0 = north, clockwise through east). */
export interface HorizonProfile {
  az_step_deg: number
  mast_m: number
  elev_deg: number[]
  /** Pixel size of the elevation model at the site, metres (optional metadata). */
  resolution_m?: number
  /** Terrain height at the site above the 1737.4 km sphere, metres (optional metadata). */
  site_height_m?: number
  source?: string
}

export interface Site {
  id: string
  name: string
  /** Planetocentric latitude, degrees, north positive. */
  lat: number
  /** East longitude, degrees (-180..180 or 0..360). */
  lon: number
  /** Height above the 1737.4 km reference sphere, metres. */
  alt_m: number
  category?: string
  mission?: string
  source_url?: string
  /** Landing date (UTC, ISO) for missions that have landed. */
  date?: string
  /** landed, planned, candidate, or feature. */
  kind?: string
  /** Caveat about the coordinates, shown next to the source link. */
  note?: string
  /** True once a person has checked the coordinates against the source. */
  verified?: boolean
  /** Terrain horizon if one has been computed; otherwise a smooth-sphere horizon is used. */
  horizon?: HorizonProfile
}

/** Positions of the Sun and Earth relative to the Moon's centre, in the Moon Mean-Earth body-fixed frame. */
export interface Ephemeris {
  /** True when this is the rough analytical stand-in rather than the SPICE table. */
  readonly approximate: boolean
  /** Valid time range, ms UTC. */
  readonly range: [number, number]
  sunEarth(tMs: number): { sun: Vec3; earth: Vec3 }
}

export interface BodyView {
  /** Azimuth of the disk centre, degrees, 0 = north, 90 = east. */
  az: number
  /** Elevation of the disk centre above the local horizontal plane, degrees. */
  el: number
  /** Angular radius of the disk, degrees. */
  radius: number
  /** Elevation of the skyline at this azimuth, degrees. */
  horizonEl: number
  /** Fraction of the disk area above the skyline, 0..1. */
  visibleFraction: number
  /** Distance from the site, km. */
  distance_km: number
}

export interface Topo {
  t: number
  sun: BodyView
  earth: BodyView & { /** Disk centre is above the skyline: usable for direct-to-Earth comms. */ visible: boolean }
}

export interface Interval {
  start: number
  end: number
  /** The interval was cut by the search window rather than by a real rise/set. */
  openStart: boolean
  openEnd: boolean
}

export interface Events {
  sunlight: Interval[]
  dte: Interval[]
  /** Next transitions after t0, or null if none inside the window. */
  nextSunset: number | null
  nextSunrise: number | null
  nextEarthset: number | null
  nextEarthrise: number | null
}

export interface Summary {
  /** Percent of the window with any part of the Sun above the skyline. */
  litPct: number
  /** Time-averaged visible fraction of the solar disk, percent. Closer to available power than litPct. */
  meanSolarPct: number
  /** Percent of the window with Earth's centre above the skyline. */
  dtePct: number
  /** Percent of the window with both sunlight and Earth in view. */
  bothPct: number
  longestNight_h: number
  longestDteGap_h: number
  maxSunEl: number
  minSunEl: number
}
