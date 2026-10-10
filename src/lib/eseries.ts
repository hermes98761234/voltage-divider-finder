export type Series = 'E3' | 'E6' | 'E12' | 'E24' | 'E48' | 'E96' | 'E192'
export const SERIES: Series[] = ['E3', 'E6', 'E12', 'E24', 'E48', 'E96', 'E192']

/** Typical resistor tolerance (percent) sold in each series. */
export const DEFAULT_TOLERANCE: Record<Series, number> = { E3: 20, E6: 20, E12: 10, E24: 5, E48: 2, E96: 1, E192: 0.5 }

// E3–E24 are defined by tables (they are not exact roundings of 10^(i/n)).
const TABLES: Partial<Record<Series, number[]>> = {
  E3: [1.0, 2.2, 4.7],
  E6: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8],
  E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1],
}

const COUNT: Record<Series, number> = { E3: 3, E6: 6, E12: 12, E24: 24, E48: 48, E96: 96, E192: 192 }

/** The significands (1.00 … 9.xx) of one decade. E48/E96/E192 are 10^(i/n) rounded to 3 significant digits. */
export function mantissas(series: Series): number[] {
  const table = TABLES[series]
  if (table) return table
  const n = COUNT[series]
  // The standard's E192 lists 9.20 where the rounding gives 9.19.
  return Array.from({ length: n }, (_, i) => Math.round(10 ** (i / n) * 100) / 100).map((x) => (n === 192 && x === 9.19 ? 9.2 : x))
}

/** All values of a series between lo and hi ohms (inclusive), ascending. */
export function seriesValues(series: Series, lo: number, hi: number): number[] {
  const out: number[] = []
  const m = mantissas(series)
  const first = Math.floor(Math.log10(lo)) - 1
  const last = Math.ceil(Math.log10(hi)) + 1
  for (let d = first; d <= last; d++) {
    for (const x of m) {
      // Multiply by an exact power of ten via string to avoid 4.7 * 1000 = 4700.000000000001 style noise.
      const v = Number(`${x}e${d}`)
      if (v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9)) out.push(v)
    }
  }
  return out
}

/** Nearest series value to v (by ratio). */
export function nearestValue(series: Series, v: number): number {
  const d = Math.floor(Math.log10(v))
  let best = NaN
  let bestErr = Infinity
  for (const dd of [d - 1, d, d + 1]) {
    for (const x of mantissas(series)) {
      const c = Number(`${x}e${dd}`)
      const e = Math.abs(Math.log(c / v))
      if (e < bestErr) {
        bestErr = e
        best = c
      }
    }
  }
  return best
}
