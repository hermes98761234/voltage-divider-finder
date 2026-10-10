import { describe, expect, it } from 'vitest'
import { mantissas, nearestValue, SERIES, seriesValues } from './eseries'

// IEC 60063 E96, written out from the standard.
const E96 = [
  1.0, 1.02, 1.05, 1.07, 1.1, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.3, 1.33, 1.37, 1.4, 1.43, 1.47, 1.5, 1.54, 1.58, 1.62, 1.65, 1.69, 1.74,
  1.78, 1.82, 1.87, 1.91, 1.96, 2.0, 2.05, 2.1, 2.15, 2.21, 2.26, 2.32, 2.37, 2.43, 2.49, 2.55, 2.61, 2.67, 2.74, 2.8, 2.87, 2.94, 3.01, 3.09,
  3.16, 3.24, 3.32, 3.4, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12, 4.22, 4.32, 4.42, 4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23, 5.36, 5.49,
  5.62, 5.76, 5.9, 6.04, 6.19, 6.34, 6.49, 6.65, 6.81, 6.98, 7.15, 7.32, 7.5, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09, 9.31, 9.53, 9.76,
]
const E48 = [
  1.0, 1.05, 1.1, 1.15, 1.21, 1.27, 1.33, 1.4, 1.47, 1.54, 1.62, 1.69, 1.78, 1.87, 1.96, 2.05, 2.15, 2.26, 2.37, 2.49, 2.61, 2.74, 2.87, 3.01,
  3.16, 3.32, 3.48, 3.65, 3.83, 4.02, 4.22, 4.42, 4.64, 4.87, 5.11, 5.36, 5.62, 5.9, 6.19, 6.49, 6.81, 7.15, 7.5, 7.87, 8.25, 8.66, 9.09, 9.53,
]

describe('E series', () => {
  it('has the right number of values per decade, ascending in [1,10)', () => {
    const n = { E3: 3, E6: 6, E12: 12, E24: 24, E48: 48, E96: 96, E192: 192 }
    for (const s of SERIES) {
      const m = mantissas(s)
      expect(m.length).toBe(n[s])
      expect(m[0]).toBe(1)
      expect(m.every((x, i) => x >= 1 && x < 10 && (i === 0 || x > m[i - 1]))).toBe(true)
    }
  })
  it('matches the standard E48 and E96 tables', () => {
    expect(mantissas('E48')).toEqual(E48)
    expect(mantissas('E96')).toEqual(E96)
  })
  it('E192 has the known neighbours', () => {
    const m = mantissas('E192')
    expect(m.slice(0, 5)).toEqual([1.0, 1.01, 1.02, 1.04, 1.05])
    expect(m.at(-1)).toBe(9.88)
    expect(m).toContain(9.2)
  })
  it('E12 is a subset of E24, E24 of E48', () => {
    const inside = (a: number[], b: number[]) => a.every((x) => b.some((y) => Math.abs(x - y) < 1e-9))
    expect(inside(mantissas('E6'), mantissas('E12'))).toBe(true)
    expect(inside(mantissas('E12'), mantissas('E24'))).toBe(true)
  })
  it('lists values across decades without float noise', () => {
    expect(seriesValues('E12', 1000, 10000)).toEqual([1000, 1200, 1500, 1800, 2200, 2700, 3300, 3900, 4700, 5600, 6800, 8200, 10000])
    expect(seriesValues('E24', 100, 1000)).toContain(470)
  })
  it('finds the nearest value', () => {
    expect(nearestValue('E12', 4800)).toBe(4700)
    expect(nearestValue('E96', 31500)).toBe(31600)
    expect(nearestValue('E24', 9.9)).toBe(10)
  })
})
