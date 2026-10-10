import { describe, expect, it } from 'vitest'
import { seriesValues } from './eseries'
import { candidates, evaluate, findPairs, idealR2, makeCombo, single, targetVout, voutOf, type Constraints, type Spec } from './divider'

const free: Constraints = { rMin: 1e3, rMax: 1e6, totalMin: 0, totalMax: Infinity, maxCurrent: Infinity }
const div = (vin: number, vout: number, load = Infinity): Spec => ({ kind: 'divider', vin, vref: 0, ratio: vout / vin, load })
const fb = (vout: number, vref: number): Spec => ({ kind: 'feedback', vin: vout, vref, ratio: 0, load: Infinity })

describe('evaluate', () => {
  it('textbook divider: 12 V across 10k/10k is 6 V', () => {
    const e = evaluate(div(12, 6), single(1e4), single(1e4))
    expect(e.vout).toBeCloseTo(6, 12)
    expect(e.current).toBeCloseTo(0.0006, 12)
    expect(e.pR1).toBeCloseTo(0.0036, 12)
    expect(e.zOut).toBeCloseTo(5000, 9)
    expect(e.error).toBeCloseTo(0, 12)
  })
  it('a load across R2 pulls the output down', () => {
    const e = evaluate(div(10, 5, 1e4), single(1e4), single(1e4))
    expect(e.vout).toBeCloseTo(10 / 3, 12)
    expect(e.voutUnloaded).toBeCloseTo(5, 12)
    expect(e.error).toBeCloseTo(-1 / 3, 12)
  })
  it('feedback divider: Vref 0.8 V, 100k over 32k gives 3.3 V', () => {
    const s = fb(3.3, 0.8)
    expect(voutOf(s, 1e5, 3.2e4)).toBeCloseTo(3.3, 12)
    expect(evaluate(s, single(1e5), single(3.2e4)).error).toBeCloseTo(0, 12)
    // LM317-style: 1.25 V ref, 240 over 720 -> 5 V
    expect(voutOf(fb(5, 1.25), 3000, 1000)).toBeCloseTo(5, 12)
  })
  it('series and parallel combos', () => {
    expect(makeCombo('series', [1e3, 2e3]).value).toBe(3000)
    expect(makeCombo('parallel', [1e3, 1e3]).value).toBeCloseTo(500, 12)
    expect(makeCombo('parallel', [2e3, 3e3]).value).toBeCloseTo(1200, 9)
  })
})

describe('idealR2', () => {
  it('inverts the divider equation, with and without load', () => {
    const s = div(10, 2.5)
    expect(idealR2(s, 30000)).toBeCloseTo(10000, 9)
    const l = div(10, 2.5, 20000)
    const r2 = idealR2(l, 30000)
    expect(voutOf(l, 30000, r2)).toBeCloseTo(2.5, 9)
  })
  it('is impossible when the load alone divides too much', () => {
    expect(idealR2(div(10, 9, 1000), 1000)).toBeNaN()
    expect(idealR2(div(10, 10), 1000)).toBeNaN()
  })
})

describe('candidates', () => {
  it('singles only, or with series/parallel pairs and no duplicate values', () => {
    expect(candidates('E12', 1e3, 1e4, false).length).toBe(13)
    const c = candidates('E12', 1e3, 1e4, true)
    expect(c.length).toBeGreaterThan(100)
    expect(new Set(c.map((x) => x.value.toPrecision(9))).size).toBe(c.length)
    expect(c.every((x, i) => i === 0 || x.value >= c[i - 1].value)).toBe(true)
  })
})

/** Brute force over every single-resistor pair, to check the search does not miss anything. */
function bruteBest(spec: Spec, cons: Constraints, series: 'E12' | 'E24' | 'E96') {
  const vals = seriesValues(series, cons.rMin, cons.rMax)
  let best = Infinity
  for (const a of vals) {
    for (const b of vals) {
      const e = evaluate(spec, single(a), single(b))
      if (a + b < cons.totalMin || a + b > cons.totalMax || e.current > cons.maxCurrent) continue
      best = Math.min(best, Math.abs(e.error))
    }
  }
  return best
}

describe('findPairs', () => {
  it('finds the brute-force optimum for several targets', () => {
    for (const [spec, series] of [
      [div(5, 3.3), 'E12'],
      [div(12, 2.5), 'E24'],
      [fb(3.3, 0.8), 'E96'],
      [fb(1.8, 0.6), 'E24'],
      [div(10, 4, 1e5), 'E24'],
    ] as const) {
      const r = findPairs(spec, free, { series, combos: false })
      expect(Math.abs(r[0].error), `${spec.kind} ${targetVout(spec)} ${series}`).toBeCloseTo(bruteBest(spec, free, series), 12)
    }
  })
  it('5 V to 3.3 V with E96 gets within 0.2 percent', () => {
    const r = findPairs(div(5, 3.3), free, { series: 'E96', combos: false })
    expect(Math.abs(r[0].error)).toBeLessThan(0.002)
  })
  it('is sorted by error and returns at most the limit', () => {
    const r = findPairs(div(5, 3.3), free, { series: 'E24', combos: false, limit: 8 })
    expect(r.length).toBe(8)
    for (let i = 1; i < r.length; i++) expect(Math.abs(r[i].error)).toBeGreaterThanOrEqual(Math.abs(r[i - 1].error) - 1e-7)
  })
  it('respects total resistance and current limits', () => {
    const cons: Constraints = { ...free, totalMin: 50e3, totalMax: 200e3, maxCurrent: 5e-5 }
    const spec = div(5, 3.3)
    const r = findPairs(spec, cons, { series: 'E24', combos: false })
    expect(r.length).toBeGreaterThan(0)
    for (const x of r) {
      expect(x.r1.value + x.r2.value).toBeGreaterThanOrEqual(50e3 - 1e-6)
      expect(x.r1.value + x.r2.value).toBeLessThanOrEqual(200e3 + 1e-6)
      expect(x.current).toBeLessThanOrEqual(5e-5)
    }
    expect(Math.abs(r[0].error)).toBeCloseTo(bruteBest(spec, cons, 'E24'), 12)
  })
  it('returns nothing when the constraints cannot be met', () => {
    expect(findPairs(div(5, 3.3), { ...free, totalMax: 100 }, { series: 'E24', combos: false })).toEqual([])
  })
  it('combos are never worse than single resistors and can be exact', () => {
    const spec = div(5, 3.3)
    const single1 = findPairs(spec, free, { series: 'E12', combos: false })[0]
    const combo = findPairs(spec, free, { series: 'E12', combos: true })[0]
    expect(Math.abs(combo.error)).toBeLessThanOrEqual(Math.abs(single1.error))
    expect(Math.abs(combo.error)).toBeLessThan(0.002)
  })
  it('a loaded divider compensates for the load', () => {
    const spec = div(10, 5, 1e4)
    const best = findPairs(spec, { ...free, rMax: 1e5 }, { series: 'E96', combos: false })[0]
    expect(Math.abs(best.error)).toBeLessThan(0.005)
    expect(best.r2.value).toBeGreaterThan(best.r1.value) // 5 V from 10 V into 10k needs R2 || 10k = R1
  })
})
