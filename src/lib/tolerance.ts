import { comboValue, targetVout, voutOf, type Combo, type Spec } from './divider'

export type Dist = 'uniform' | 'gaussian'

/** Resistance range of a combination when every part may be off by ±tol (a fraction). Monotonic, so the corners suffice. */
export function comboRange(c: Combo, tol: number): [number, number] {
  return [comboValue(c.kind, c.parts.map((p) => p * (1 - tol))), comboValue(c.kind, c.parts.map((p) => p * (1 + tol)))]
}

export type WorstCase = { min: number; max: number; minError: number; maxError: number }

/**
 * Worst-case Vout: every resistor at either end of its tolerance band, and the source (Vin, or Vref for a
 * feedback divider) at either end of its own. Vout is monotonic in each, so the extremes are at the corners.
 */
export function worstCase(spec: Spec, r1: Combo, r2: Combo, tol: number, srcTol: number): WorstCase {
  const [a0, a1] = comboRange(r1, tol)
  const [b0, b1] = comboRange(r2, tol)
  let min = Infinity
  let max = -Infinity
  for (const a of [a0, a1]) {
    for (const b of [b0, b1]) {
      for (const s of [1 - srcTol, 1 + srcTol]) {
        const v = voutOf(spec, a, b, s)
        min = Math.min(min, v)
        max = Math.max(max, v)
      }
    }
  }
  const t = targetVout(spec)
  return { min, max, minError: min / t - 1, maxError: max / t - 1 }
}

/** Small deterministic PRNG, so the same inputs always draw the same histogram. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One draw in [-1, 1]: uniform, or gaussian with the band edge at 3 sigma (truncated there). */
function draw(rnd: () => number, dist: Dist): number {
  if (dist === 'uniform') return rnd() * 2 - 1
  for (;;) {
    const u = Math.max(rnd(), 1e-12)
    const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd())
    if (Math.abs(g) <= 3) return g / 3
  }
}

export type MonteCarlo = {
  n: number
  mean: number
  std: number
  min: number
  max: number
  p025: number
  p975: number
  /** share of draws within ±passBand of the target (fraction) */
  pass: number
  bins: number[]
  binMin: number
  binMax: number
}

/** Monte Carlo over every individual resistor (so a series pair really has two tolerances) and the source. */
export function monteCarlo(
  spec: Spec, r1: Combo, r2: Combo,
  o: { tol: number; srcTol: number; dist: Dist; n?: number; seed?: number; passBand: number; bins?: number },
): MonteCarlo {
  const n = o.n ?? 20000
  const nb = o.bins ?? 41
  const rnd = mulberry32(o.seed ?? 1)
  const target = targetVout(spec)
  const sample = (c: Combo) => comboValue(c.kind, c.parts.map((p) => p * (1 + o.tol * draw(rnd, o.dist))))
  const v = new Float64Array(n)
  let sum = 0
  let pass = 0
  for (let i = 0; i < n; i++) {
    const a = sample(r1)
    const b = sample(r2)
    const s = 1 + o.srcTol * draw(rnd, o.dist)
    v[i] = voutOf(spec, a, b, s)
    sum += v[i]
    if (Math.abs(v[i] / target - 1) <= o.passBand + 1e-12) pass++
  }
  const mean = sum / n
  let ss = 0
  for (const x of v) ss += (x - mean) ** 2
  const sorted = Float64Array.from(v).sort()
  const min = sorted[0]
  const max = sorted[n - 1]
  const bins = new Array<number>(nb).fill(0)
  const span = max - min || 1
  for (const x of v) bins[Math.min(nb - 1, Math.floor(((x - min) / span) * nb))]++
  return {
    n, mean, std: Math.sqrt(ss / n), min, max,
    p025: sorted[Math.floor(0.025 * (n - 1))], p975: sorted[Math.ceil(0.975 * (n - 1))],
    pass: pass / n, bins, binMin: min, binMax: max,
  }
}
