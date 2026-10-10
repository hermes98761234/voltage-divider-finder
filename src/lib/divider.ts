import { seriesValues, type Series } from './eseries'

/**
 * What the divider has to do.
 * - divider: Vout = Vin · R2 / (R1 + R2), optionally with a load across R2. `ratio` is the wanted Vout/Vin.
 * - feedback: Vout = Vref · (1 + R1 / R2), the feedback network of a regulator. `vin` holds the wanted Vout.
 * R1 is always the upper resistor and R2 the lower one.
 */
export type Spec = {
  kind: 'divider' | 'feedback'
  /** divider: input voltage; feedback: wanted output voltage */
  vin: number
  /** feedback only: reference voltage at the FB pin */
  vref: number
  /** divider only: wanted Vout / Vin */
  ratio: number
  /** load resistance across R2 (divider only); Infinity for none */
  load: number
}

export type Combo = { kind: 'single' | 'series' | 'parallel'; parts: number[]; value: number }

export type Constraints = {
  /** value range of each individual resistor taken from the series */
  rMin: number
  rMax: number
  /** range of R1 + R2 (the divider's own resistance, load excluded) */
  totalMin: number
  totalMax: number
  /** highest allowed current through the divider in amps (Infinity for none) */
  maxCurrent: number
}

export type SearchOptions = { series: Series; combos: boolean; limit?: number }

export type Evaluation = {
  vout: number
  target: number
  /** relative error of Vout (or of the ratio), as a fraction */
  error: number
  /** the Vout/Vin ratio actually achieved (divider) or Vref/Vout (feedback) */
  ratio: number
  current: number
  pR1: number
  pR2: number
  /** Thevenin resistance seen at the output: R1 ‖ R2 (‖ load) */
  zOut: number
  /** Vout without the load (divider only) */
  voutUnloaded: number
}

export type Result = { r1: Combo; r2: Combo } & Evaluation

export function single(v: number): Combo {
  return { kind: 'single', parts: [v], value: v }
}

export function comboValue(kind: Combo['kind'], parts: number[]): number {
  if (kind === 'series') return parts.reduce((a, b) => a + b, 0)
  if (kind === 'parallel') return 1 / parts.reduce((a, b) => a + 1 / b, 0)
  return parts[0]
}

export function makeCombo(kind: Combo['kind'], parts: number[]): Combo {
  return { kind, parts, value: comboValue(kind, parts) }
}

/** R2 in parallel with the load. */
export function lowerEff(r2: number, load: number): number {
  return Number.isFinite(load) ? (r2 * load) / (r2 + load) : r2
}

/** Output voltage for given resistances. `src` scales Vin (divider) or Vref (feedback). */
export function voutOf(spec: Spec, r1: number, r2: number, src = 1): number {
  if (spec.kind === 'feedback') return spec.vref * src * (1 + r1 / r2)
  const low = lowerEff(r2, spec.load)
  return (spec.vin * src * low) / (r1 + low)
}

export function targetVout(spec: Spec): number {
  return spec.kind === 'feedback' ? spec.vin : spec.vin * spec.ratio
}

export function evaluate(spec: Spec, a: Combo, b: Combo): Evaluation {
  const r1 = a.value
  const r2 = b.value
  const vout = voutOf(spec, r1, r2)
  const target = targetVout(spec)
  const low = spec.kind === 'divider' ? lowerEff(r2, spec.load) : r2
  const vsup = spec.vin
  const current = spec.kind === 'feedback' ? vout / (r1 + r2) : vsup / (r1 + low)
  const iR2 = spec.kind === 'feedback' ? current : vout / r2
  return {
    vout,
    target,
    error: vout / target - 1,
    ratio: spec.kind === 'feedback' ? spec.vref / vout : vout / spec.vin,
    current,
    pR1: current * current * r1,
    pR2: iR2 * iR2 * r2,
    zOut: (r1 * low) / (r1 + low),
    voutUnloaded: spec.kind === 'divider' ? (spec.vin * r2) / (r1 + r2) : vout,
  }
}

/** The ideal R2 for a given R1 (a continuous value); NaN when no R2 can reach the target. */
export function idealR2(spec: Spec, r1: number): number {
  const r = spec.kind === 'feedback' ? spec.vref / spec.vin : spec.ratio
  if (!(r > 0 && r < 1)) return NaN
  const rb = (r1 * r) / (1 - r)
  if (spec.kind === 'feedback' || !Number.isFinite(spec.load)) return rb
  return rb < spec.load ? (rb * spec.load) / (spec.load - rb) : NaN
}

/** Every resistance reachable with one resistor, or two in series/parallel (within 10:1 of each other). */
export function candidates(series: Series, rMin: number, rMax: number, combos: boolean): Combo[] {
  const base = seriesValues(series, rMin, rMax)
  const byValue = new Map<string, Combo>()
  const add = (c: Combo) => {
    const key = c.value.toPrecision(9)
    const old = byValue.get(key)
    if (!old || c.parts.length < old.parts.length) byValue.set(key, c)
  }
  for (const v of base) add(single(v))
  if (combos) {
    for (let i = 0; i < base.length; i++) {
      for (let j = i; j < base.length && base[j] <= base[i] * 10; j++) {
        add(makeCombo('series', [base[i], base[j]]))
        add(makeCombo('parallel', [base[i], base[j]]))
      }
    }
  }
  return [...byValue.values()].sort((x, y) => x.value - y.value)
}

/** Index of the first element with value >= v. */
function lowerBound(c: Combo[], v: number): number {
  let lo = 0
  let hi = c.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (c[mid].value < v) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * The best (R1, R2) pairs for the spec: for every R1 candidate the R2 candidates around the ideal value
 * are tried, so the search is exhaustive over R1 and only looks at the neighbours that can win for R2.
 * Sorted by absolute error, then by number of parts, then by lower current draw.
 */
export function findPairs(spec: Spec, cons: Constraints, opts: SearchOptions): Result[] {
  const limit = opts.limit ?? 20
  const cands = candidates(opts.series, cons.rMin, cons.rMax, opts.combos)
  const found = new Map<string, Result>()
  for (const r1 of cands) {
    const want = idealR2(spec, r1.value)
    if (!(want > 0)) continue
    const at = lowerBound(cands, want)
    const local: Result[] = []
    for (let k = at - 2; k <= at + 1; k++) {
      const r2 = cands[k]
      if (!r2) continue
      const total = r1.value + r2.value
      if (total < cons.totalMin * (1 - 1e-12) || total > cons.totalMax * (1 + 1e-12)) continue
      const e = evaluate(spec, r1, r2)
      if (!Number.isFinite(e.error) || e.current > cons.maxCurrent) continue
      local.push({ r1, r2, ...e })
    }
    local.sort((x, y) => Math.abs(x.error) - Math.abs(y.error))
    for (const r of local.slice(0, 2)) found.set(`${r.r1.value}|${r.r2.value}`, r)
  }
  const rank = (r: Result) => [Math.round(Math.abs(r.error) * 1e7), r.r1.parts.length + r.r2.parts.length, r.r1.value + r.r2.value]
  return [...found.values()]
    .sort((x, y) => {
      const a = rank(x)
      const b = rank(y)
      return a[0] - b[0] || a[1] - b[1] || b[2] - a[2]
    })
    .slice(0, limit)
}
