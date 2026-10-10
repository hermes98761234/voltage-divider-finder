import { describe, expect, it } from 'vitest'
import { single, makeCombo, type Spec } from './divider'
import { comboRange, monteCarlo, mulberry32, worstCase } from './tolerance'

const spec: Spec = { kind: 'divider', vin: 10, vref: 0, ratio: 0.5, load: Infinity }

describe('worstCase', () => {
  it('10k/10k at 1% gives 4.95 to 5.05 V', () => {
    const w = worstCase(spec, single(1e4), single(1e4), 0.01, 0)
    expect(w.max).toBeCloseTo((10 * 10100) / (9900 + 10100), 12)
    expect(w.min).toBeCloseTo((10 * 9900) / (10100 + 9900), 12)
    expect(w.maxError).toBeCloseTo(0.01, 12)
  })
  it('source tolerance adds to it', () => {
    const w = worstCase(spec, single(1e4), single(1e4), 0, 0.02)
    expect(w.max).toBeCloseTo(5.1, 12)
    expect(w.min).toBeCloseTo(4.9, 12)
  })
  it('feedback divider: Vref and resistors both count', () => {
    const f: Spec = { kind: 'feedback', vin: 3.3, vref: 0.8, ratio: 0, load: Infinity }
    const w = worstCase(f, single(1e5), single(3.2e4), 0.01, 0.01)
    expect(w.max).toBeCloseTo(0.8 * 1.01 * (1 + (1e5 * 1.01) / (3.2e4 * 0.99)), 12)
  })
  it('a parallel pair of same-tolerance parts stays within that tolerance', () => {
    const c = makeCombo('parallel', [2e3, 2e3])
    const [lo, hi] = comboRange(c, 0.05)
    expect(lo / c.value - 1).toBeCloseTo(-0.05, 12)
    expect(hi / c.value - 1).toBeCloseTo(0.05, 12)
  })
})

describe('monteCarlo', () => {
  const o = { tol: 0.01, srcTol: 0, dist: 'uniform' as const, passBand: 0.01 }
  it('is deterministic and centred on the nominal value', () => {
    const a = monteCarlo(spec, single(1e4), single(1e4), o)
    const b = monteCarlo(spec, single(1e4), single(1e4), o)
    expect(a).toEqual(b)
    expect(a.mean).toBeCloseTo(5, 2)
  })
  it('matches the analytic spread: sigma(Vout) ~ 0.5 * 0.01/sqrt(3) * sqrt(2) * 5 V', () => {
    const m = monteCarlo(spec, single(1e4), single(1e4), { ...o, n: 40000 })
    expect(m.std).toBeCloseTo(0.5 * (0.01 / Math.sqrt(3)) * Math.SQRT2 * 5, 3)
  })
  it('stays inside the worst case and fills the histogram', () => {
    const w = worstCase(spec, single(1e4), single(1e4), 0.01, 0)
    const m = monteCarlo(spec, single(1e4), single(1e4), o)
    expect(m.min).toBeGreaterThanOrEqual(w.min)
    expect(m.max).toBeLessThanOrEqual(w.max)
    expect(m.bins.reduce((a, b) => a + b, 0)).toBe(m.n)
    expect(m.pass).toBe(1) // worst case is exactly +-1%, the band is +-1%
  })
  it('gaussian draws have a narrower spread than uniform ones', () => {
    const u = monteCarlo(spec, single(1e4), single(1e4), o)
    const g = monteCarlo(spec, single(1e4), single(1e4), { ...o, dist: 'gaussian' })
    expect(g.std).toBeLessThan(u.std)
  })
  it('reports the share inside a tight band', () => {
    const m = monteCarlo(spec, single(1e4), single(1e4), { ...o, passBand: 0.002 })
    expect(m.pass).toBeGreaterThan(0.2)
    expect(m.pass).toBeLessThan(0.6)
  })
})

describe('mulberry32', () => {
  it('stays in [0,1) and repeats per seed', () => {
    const a = mulberry32(5)
    const b = mulberry32(5)
    for (let i = 0; i < 100; i++) {
      const x = a()
      expect(x).toBe(b())
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })
})
