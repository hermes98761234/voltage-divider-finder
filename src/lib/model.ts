import { DEFAULT_TOLERANCE, SERIES, type Series } from './eseries'
import { parseR } from './format'
import type { Constraints, Spec } from './divider'
import type { Dist } from './tolerance'
import { N } from '../i18n'

export type Lang = 'en' | 'uk'
export type Theme = 'auto' | 'light' | 'dark'
export type Mode = 'divider' | 'ratio' | 'feedback' | 'adc'
export const MODES: Mode[] = ['divider', 'feedback', 'adc', 'ratio']

/** Every numeric field is kept as the text the user typed, so "4k7" and half-typed numbers survive re-renders. */
export type AppState = {
  mode: Mode
  vin: string
  vout: string
  ratio: string
  vref: string
  adcVref: string
  adcBits: string
  load: string
  series: Series
  combos: boolean
  rMin: string
  rMax: string
  totalMin: string
  totalMax: string
  maxCurrentMa: string
  tolPct: string
  srcTolPct: string
  dist: Dist
  passPct: string
  customR1: string
  customR2: string
  lang: Lang
  theme: Theme
}

export const DEFAULT_STATE: AppState = {
  mode: 'divider',
  vin: '5',
  vout: '3.3',
  ratio: '0.25',
  vref: '0.8',
  adcVref: '3.3',
  adcBits: '12',
  load: '',
  series: 'E96',
  combos: false,
  rMin: '1k',
  rMax: '1M',
  totalMin: '',
  totalMax: '',
  maxCurrentMa: '',
  tolPct: '1',
  srcTolPct: '0',
  dist: 'uniform',
  passPct: '1',
  customR1: '',
  customR2: '',
  lang: 'en',
  theme: 'auto',
}

export type Preset = { name: string; state: Partial<AppState> }

/** Starting points; `name` is a translation key. */
export const PRESETS: Preset[] = [
  { name: N('5 V to 3.3 V logic level'), state: { mode: 'divider', vin: '5', vout: '3.3', series: 'E96', tolPct: '1', load: '', rMin: '1k', rMax: '1M', maxCurrentMa: '' } },
  { name: N('12 V to a 3.3 V ADC pin'), state: { mode: 'adc', vin: '12', adcVref: '3.3', adcBits: '12', series: 'E96', tolPct: '1', load: '', rMin: '1k', rMax: '1M', maxCurrentMa: '' } },
  { name: N('4.2 V battery to a 1.1 V ADC, under 50 µA'), state: { mode: 'adc', vin: '4.2', adcVref: '1.1', adcBits: '10', series: 'E96', tolPct: '1', load: '', rMin: '10k', rMax: '10M', maxCurrentMa: '0.05' } },
  { name: N('3.3 V regulator, 0.8 V feedback'), state: { mode: 'feedback', vin: '3.3', vref: '0.8', series: 'E96', tolPct: '1', srcTolPct: '1', rMin: '1k', rMax: '1M', maxCurrentMa: '', load: '' } },
  { name: N('5 V from an LM317 (1.25 V)'), state: { mode: 'feedback', vin: '5', vref: '1.25', series: 'E24', tolPct: '5', srcTolPct: '4', rMin: '100', rMax: '10k', maxCurrentMa: '', load: '' } },
  { name: N('10 V to 5 V into a 100 kΩ load'), state: { mode: 'divider', vin: '10', vout: '5', load: '100k', series: 'E24', tolPct: '5', rMin: '1k', rMax: '1M', maxCurrentMa: '' } },
  { name: N('Exact 1:4 ratio with E12 parts'), state: { mode: 'ratio', vin: '10', ratio: '0.25', series: 'E12', combos: true, tolPct: '10', rMin: '1k', rMax: '100k', load: '', maxCurrentMa: '' } },
]

export const COMMON_VREFS: { v: number; label: string }[] = [
  { v: 0.5, label: '0.5' },
  { v: 0.6, label: '0.6' },
  { v: 0.8, label: '0.8' },
  { v: 1.0, label: '1.0' },
  { v: 1.1, label: '1.1' },
  { v: 1.23, label: '1.23' },
  { v: 1.25, label: '1.25' },
  { v: 2.5, label: '2.5' },
]

const num = (s: string) => (s.trim() === '' ? NaN : Number(s.trim().replace(',', '.')))

export type Parsed =
  | { ok: true; spec: Spec; cons: Constraints; tol: number; srcTol: number; passBand: number; target: number; lsb: number }
  | { ok: false; bad: Set<keyof AppState> }

/** Validates the text fields and builds the numbers the maths needs. */
export function parseState(s: AppState): Parsed {
  const bad = new Set<keyof AppState>()
  const need = (key: keyof AppState, v: number, ok: (x: number) => boolean) => {
    if (!(Number.isFinite(v) && ok(v))) bad.add(key)
    return v
  }
  const pos = (x: number) => x > 0
  let vin = 1
  let vout = 0
  let vref = 0
  let ratio = 0
  let lsb = NaN
  if (s.mode === 'divider') {
    vin = need('vin', num(s.vin), pos)
    vout = need('vout', num(s.vout), pos)
    if (!bad.has('vin') && !bad.has('vout') && vout >= vin) bad.add('vout')
    ratio = vout / vin
  } else if (s.mode === 'ratio') {
    vin = need('vin', num(s.vin), pos)
    ratio = need('ratio', num(s.ratio), (x) => x > 0 && x < 1)
  } else if (s.mode === 'adc') {
    vin = need('vin', num(s.vin), pos)
    vout = need('adcVref', num(s.adcVref), pos)
    const bits = need('adcBits', num(s.adcBits), (x) => Number.isInteger(x) && x >= 1 && x <= 32)
    if (!bad.has('vin') && !bad.has('adcVref') && vout >= vin) bad.add('adcVref')
    ratio = vout / vin
    lsb = vout / 2 ** bits
  } else {
    vout = need('vin', num(s.vin), pos)
    vref = need('vref', num(s.vref), pos)
    if (!bad.has('vin') && !bad.has('vref') && vref >= vout) bad.add('vref')
    vin = vout
  }
  const optional = (key: keyof AppState, dflt: number, ok: (x: number) => boolean) => {
    const text = (s[key] as string).trim()
    if (text === '') return dflt
    return need(key, parseR(text), ok)
  }
  const load = s.mode === 'feedback' ? Infinity : optional('load', Infinity, pos)
  const rMin = need('rMin', parseR(s.rMin), pos)
  const rMax = need('rMax', parseR(s.rMax), pos)
  if (!bad.has('rMin') && !bad.has('rMax') && rMin > rMax) bad.add('rMax')
  const totalMin = optional('totalMin', 0, pos)
  const totalMax = optional('totalMax', Infinity, pos)
  if (!bad.has('totalMin') && !bad.has('totalMax') && totalMin > totalMax) bad.add('totalMax')
  const ma = s.maxCurrentMa.trim() === '' ? Infinity : need('maxCurrentMa', num(s.maxCurrentMa), pos) / 1000
  const tol = need('tolPct', num(s.tolPct), (x) => x >= 0 && x < 100) / 100
  const srcTol = s.srcTolPct.trim() === '' ? 0 : need('srcTolPct', num(s.srcTolPct), (x) => x >= 0 && x < 100) / 100
  const passBand = need('passPct', num(s.passPct), (x) => x > 0 && x < 100) / 100
  if (bad.size > 0) return { ok: false, bad }
  const spec: Spec = { kind: s.mode === 'feedback' ? 'feedback' : 'divider', vin, vref, ratio, load }
  const target = s.mode === 'feedback' ? vin : vin * ratio
  return { ok: true, spec, cons: { rMin, rMax, totalMin, totalMax, maxCurrent: ma }, tol, srcTol, passBand, target, lsb }
}

export function applySeries(s: AppState, series: Series): AppState {
  return { ...s, series, tolPct: String(DEFAULT_TOLERANCE[series]) }
}

const KEY = 'voltage-divider-finder:v1'

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], dflt: T): T => (allowed.includes(v as T) ? (v as T) : dflt)

export function loadState(): AppState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!raw || typeof raw !== 'object') return DEFAULT_STATE
    const out: Record<string, unknown> = { ...DEFAULT_STATE }
    // Saved data may be from an older version or hand-edited: keep only fields of the right type.
    for (const [k, d] of Object.entries(DEFAULT_STATE)) {
      if (typeof raw[k] === typeof d) out[k] = raw[k]
    }
    const st = out as AppState
    return {
      ...st,
      mode: oneOf(st.mode, MODES, DEFAULT_STATE.mode),
      series: oneOf(st.series, SERIES, DEFAULT_STATE.series),
      dist: oneOf(st.dist, ['uniform', 'gaussian'] as const, DEFAULT_STATE.dist),
      lang: oneOf(st.lang, ['en', 'uk'] as const, DEFAULT_STATE.lang),
      theme: oneOf(st.theme, ['auto', 'light', 'dark'] as const, DEFAULT_STATE.theme),
    }
  } catch {
    return DEFAULT_STATE
  }
}

export function saveState(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // Private mode or quota: the app still works, it just won't remember.
  }
}
