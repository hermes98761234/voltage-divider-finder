import type { Combo } from './divider'

/** Formats ohms with an SI-style suffix: 4700 → "4.7k", 1e6 → "1M", 0.47 → "470m". */
export function formatR(ohms: number): string {
  if (!Number.isFinite(ohms)) return '–'
  const a = Math.abs(ohms)
  const [div, suf] = a >= 1e9 ? [1e9, 'G'] : a >= 1e6 ? [1e6, 'M'] : a >= 1e3 ? [1e3, 'k'] : a >= 1 || a === 0 ? [1, ''] : [1e-3, 'm']
  const x = ohms / div
  const s = String(+x.toFixed(Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2))
  return s + suf
}

/** Parses "4.7k", "10K", "2M2", "4k7", "1e3", "470", "0.5" into a number; NaN if it isn't one. */
export function parseR(text: string): number {
  const s = text.trim().replace(/\s+/g, '').replace(/[\u03a9\u2126]|ohms?$/gi, '').replace(/,/g, '.')
  if (s === '') return NaN
  const mult: Record<string, number> = { r: 1, k: 1e3, m: 1e6, g: 1e9 }
  // 4k7 style: letter in the middle acts as the decimal point
  const mid = /^(\d+)([rkmg])(\d+)$/i.exec(s)
  if (mid) return Number(`${mid[1]}.${mid[3]}`) * mult[mid[2].toLowerCase()]
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([rkmg]?)$/i.exec(s)
  if (!m) return NaN
  return Number(m[1]) * (m[2] ? mult[m[2].toLowerCase()] : 1)
}

/** A voltage with sensible digits: 3.3 → "3.3 V", 0.0123 → "12.3 mV". */
export function formatV(v: number): string {
  if (!Number.isFinite(v)) return '–'
  const a = Math.abs(v)
  if (a !== 0 && a < 1) return `${+(v * 1000).toPrecision(4)} mV`
  return `${+v.toPrecision(5)} V`
}

export function formatCurrent(i: number): string {
  if (!Number.isFinite(i)) return '–'
  const a = Math.abs(i)
  if (a === 0) return '0 A'
  if (a < 1e-3) return `${+(i * 1e6).toPrecision(3)} µA`
  if (a < 1) return `${+(i * 1e3).toPrecision(3)} mA`
  return `${+i.toPrecision(3)} A`
}

export function formatPower(p: number): string {
  if (!Number.isFinite(p)) return '–'
  const a = Math.abs(p)
  if (a === 0) return '0 W'
  if (a < 1e-3) return `${+(p * 1e6).toPrecision(3)} µW`
  if (a < 1) return `${+(p * 1e3).toPrecision(3)} mW`
  return `${+p.toPrecision(3)} W`
}

export function formatPct(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return '–'
  const s = +x.toPrecision(digits)
  return `${s > 0 ? '+' : ''}${s}%`
}

/** "4.7k", "1k + 3.3k" (series) or "10k ‖ 22k" (parallel). */
export function comboText(c: Combo): string {
  return c.kind === 'single' ? formatR(c.value) : c.parts.map(formatR).join(c.kind === 'series' ? ' + ' : ' ‖ ')
}
