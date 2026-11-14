import { describe, expect, it } from 'vitest'
import {
  EARTH_DISTANCE,
  EARTH_RADIUS,
  MIN_GAP,
  MOON_RADIUS,
  SUN_DISTANCE,
  SUN_RADIUS,
  SYSTEM_VIEW_DISTANCE,
} from '../src/views/skyScale'

/**
 * Around full Moon the Sun and Earth are in the same direction from the Moon. With the compressed
 * distances of the 3D scene they would run into each other unless each keeps to its own band.
 */
describe('3D scene scale', () => {
  it('keeps the Moon, Earth and Sun apart even when they line up', () => {
    const earthNear = EARTH_DISTANCE - EARTH_RADIUS
    const earthFar = EARTH_DISTANCE + EARTH_RADIUS
    const sunNear = SUN_DISTANCE - SUN_RADIUS
    expect(earthNear - MOON_RADIUS).toBeGreaterThanOrEqual(MIN_GAP)
    expect(sunNear - earthFar).toBeGreaterThanOrEqual(MIN_GAP)
  })
  it('keeps the order of sizes right', () => {
    expect(SUN_RADIUS).toBeGreaterThan(EARTH_RADIUS)
    expect(EARTH_RADIUS).toBeGreaterThan(MOON_RADIUS)
  })
  it('frames all three in the wide view', () => {
    // Vertical half-height of the view at the origin for the 34 degree camera.
    const halfHeight = SYSTEM_VIEW_DISTANCE * Math.tan((17 * Math.PI) / 180)
    expect(halfHeight).toBeGreaterThan(SUN_DISTANCE + SUN_RADIUS)
  })
})
