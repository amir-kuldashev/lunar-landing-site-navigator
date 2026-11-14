import { describe, expect, it } from 'vitest'
import { readUrlState } from '../src/lib/urlState'

describe('shareable link parsing', () => {
  it('reads a site, a time and pins', () => {
    const s = readUrlState('?site=im-2&t=2027-03-10T06:00&pins=im-2@2027-03-10T06:00~c:-85,30@2027-04-01T12:30')
    expect(s.siteId).toBe('im-2')
    expect(s.t).toBe(Date.UTC(2027, 2, 10, 6, 0))
    expect(s.pins).toHaveLength(2)
    expect(s.pins[1].custom).toEqual({ lat: -85, lon: 30 })
    expect(s.pins[1].t).toBe(Date.UTC(2027, 3, 1, 12, 30))
  })
  it('reads a custom point', () => {
    expect(readUrlState('?at=-89.5,225&t=2027-01-01T00:00').custom).toEqual({ lat: -89.5, lon: 225 })
  })
  it('ignores junk instead of failing', () => {
    const s = readUrlState('?site=&t=yesterday&at=200,abc&pins=nope~x@bad~@')
    expect(s.t).toBeUndefined()
    expect(s.custom).toBeUndefined()
    expect(s.pins).toEqual([])
  })
})
