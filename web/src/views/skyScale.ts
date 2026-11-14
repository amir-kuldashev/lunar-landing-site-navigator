/**
 * Sizes and distances of the bodies in the 3D scene, in lunar radii (the Moon is 1, at the origin).
 *
 * These are schematic. The order of sizes is right (Sun, then Earth, then Moon), but Earth is really
 * 3.7 times the Moon's width and the Sun 109 times Earth's, and both are far more distant than drawn.
 *
 * The one hard rule: the bodies must never touch. Around full Moon the Sun and Earth lie in almost the
 * same direction from the Moon, so they sit on one line. Each body therefore gets its own band of
 * distance with clear space between: Moon, gap, Earth, gap, Sun. tests/skyScale.test.ts enforces this.
 */
export const MOON_RADIUS = 1
export const EARTH_RADIUS = 2.2
export const EARTH_DISTANCE = 6.5
export const SUN_RADIUS = 3.4
export const SUN_DISTANCE = 16
/** Smallest clear space allowed between any two bodies along a shared line. */
export const MIN_GAP = 2
/** Camera distance that frames the Moon, Earth and Sun together. */
export const SYSTEM_VIEW_DISTANCE = 68
