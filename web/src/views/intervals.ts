import type { Interval } from '../core'

/**
 * Computes the intersection of two sorted lists of disjoint intervals.
 * Used to find intervals where BOTH sunlight and direct-to-Earth comms are available.
 */
export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const result: Interval[] = []
  let i = 0
  let j = 0

  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].start, b[j].start)
    const end = Math.min(a[i].end, b[j].end)

    if (start < end) {
      result.push({
        start,
        end,
        openStart: a[i].openStart && b[j].openStart && start === a[i].start && start === b[j].start,
        openEnd: a[i].openEnd && b[j].openEnd && end === a[i].end && end === b[j].end,
      })
    }

    if (a[i].end < b[j].end) {
      i++
    } else {
      j++
    }
  }

  return result
}
