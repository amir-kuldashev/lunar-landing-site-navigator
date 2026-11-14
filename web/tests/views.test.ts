import { describe, expect, it } from 'vitest'
import { intersectIntervals } from '../src/views/intervals'
import type { Interval } from '../src/core'

describe('intervals intersection for Timeline joint window', () => {
  it('returns empty when one list is empty', () => {
    const a: Interval[] = [{ start: 0, end: 100, openStart: false, openEnd: false }]
    expect(intersectIntervals(a, [])).toEqual([])
    expect(intersectIntervals([], a)).toEqual([])
  })

  it('correctly intersects overlapping intervals', () => {
    const a: Interval[] = [
      { start: 0, end: 50, openStart: false, openEnd: false },
      { start: 60, end: 100, openStart: false, openEnd: false },
    ]
    const b: Interval[] = [
      { start: 20, end: 80, openStart: false, openEnd: false },
    ]

    const result = intersectIntervals(a, b)
    expect(result).toHaveLength(2)
    expect(result[0].start).toBe(20)
    expect(result[0].end).toBe(50)
    expect(result[1].start).toBe(60)
    expect(result[1].end).toBe(80)
  })

  it('handles disjoint non-overlapping intervals', () => {
    const a: Interval[] = [{ start: 0, end: 20, openStart: false, openEnd: false }]
    const b: Interval[] = [{ start: 30, end: 50, openStart: false, openEnd: false }]
    expect(intersectIntervals(a, b)).toEqual([])
  })

  it('handles nested intervals', () => {
    const outer: Interval[] = [{ start: 0, end: 100, openStart: false, openEnd: false }]
    const inner: Interval[] = [{ start: 30, end: 60, openStart: false, openEnd: false }]
    const res = intersectIntervals(outer, inner)
    expect(res).toHaveLength(1)
    expect(res[0].start).toBe(30)
    expect(res[0].end).toBe(60)
  })
})
