import { useEffect, useMemo, useState } from 'react'
import { applySeries, COMMON_VREFS, DEFAULT_STATE, loadState, MODES, parseState, PRESETS, saveState, type AppState, type Mode } from './lib/model'
import { SERIES, type Series } from './lib/eseries'
import { evaluate, single, type Combo, type Result } from './lib/divider'
import { comboText, formatCurrent, formatPct, formatPower, formatR, formatV, parseR } from './lib/format'
import { monteCarlo, worstCase } from './lib/tolerance'
import { N, tr, type T } from './i18n'
import { useFinder } from './useFinder'
import ValueField from './components/ValueField'
import Schematic from './components/Schematic'
import Histogram from './components/Histogram'

const MODE_LABEL: Record<Mode, string> = {
  divider: N('Voltage divider'),
  feedback: N('Feedback divider'),
  adc: N('ADC input'),
  ratio: N('Ratio'),
}
const MODE_HINT: Record<Mode, string> = {
  divider: N('Vout = Vin · R2 / (R1 + R2). Pick Vin and the wanted Vout.'),
  feedback: N('Vout = Vref · (1 + R1 / R2) for adjustable regulators. R1 is the upper resistor, from Vout to the FB pin.'),
  adc: N('Scale a signal down so that its maximum reads as the ADC full scale.'),
  ratio: N('Hit a bare Vout / Vin ratio. Vin is only used for current and power.'),
}

export default function App() {
  const [s, setS] = useState<AppState>(loadState)
  const [sel, setSel] = useState(0)
  const [copied, setCopied] = useState(false)
  const t: T = (str, ...a) => tr(s.lang, str, ...a)
  const set = (patch: Partial<AppState>) => setS((o) => ({ ...o, ...patch }))
  const parsed = useMemo(() => parseState(s), [s])
  const bad = parsed.ok ? new Set<string>() : parsed.bad

  useEffect(() => saveState(s), [s])
  useEffect(() => {
    const root = document.documentElement
    if (s.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = s.theme
    root.lang = s.lang
  }, [s.theme, s.lang])

  const finder = useFinder(parsed.ok ? { spec: parsed.spec, cons: parsed.cons, opts: { series: s.series, combos: s.combos, limit: 12 } } : null)
  const results: Result[] = finder.state === 'done' ? finder.results : []

  // A pair typed in by hand, to check values you already have in the drawer.
  const custom = useMemo(() => {
    const a = parseR(s.customR1)
    const b = parseR(s.customR2)
    return a > 0 && b > 0 && Number.isFinite(a + b) ? { r1: single(a), r2: single(b) } : null
  }, [s.customR1, s.customR2])
  const customBad = (s.customR1.trim() !== '' && !(parseR(s.customR1) > 0)) || (s.customR2.trim() !== '' && !(parseR(s.customR2) > 0))

  const chosen: { r1: Combo; r2: Combo; custom: boolean } | null =
    sel === -1 && custom ? { ...custom, custom: true } : results.length > 0 ? { r1: results[Math.min(sel, results.length - 1)].r1, r2: results[Math.min(sel, results.length - 1)].r2, custom: false } : null

  const detail = useMemo(() => {
    if (!parsed.ok || !chosen) return null
    const { spec, tol, srcTol, passBand, target } = parsed
    const ev = evaluate(spec, chosen.r1, chosen.r2)
    const wc = worstCase(spec, chosen.r1, chosen.r2, tol, srcTol)
    const mc = monteCarlo(spec, chosen.r1, chosen.r2, { tol, srcTol, dist: s.dist, passBand })
    return { ev, wc, mc, target }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chosen is derived from the listed inputs
  }, [parsed, chosen?.r1.value, chosen?.r2.value, chosen?.r1.kind, chosen?.r2.kind, s.dist])

  const feedback = s.mode === 'feedback'
  const vinLabel = feedback ? t('Output voltage') : s.mode === 'adc' ? t('Max input voltage') : t('Input voltage')
  const copy = () => {
    if (!chosen) return
    const text = `R1 = ${comboText(chosen.r1)} Ω, R2 = ${comboText(chosen.r2)} Ω`
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }, () => {})
  }
  const errClass = (e: number) => (Math.abs(e) < 0.005 ? 'ok-text' : Math.abs(e) < 0.02 ? 'warn-text' : 'err-text')

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('Voltage divider finder')}</span>
        <span className="hint">{t('Best E-series resistor pairs for a target voltage, with tolerance analysis.')}</span>
      </header>
      <div className="body">
        <aside className="side">
          <div className="panel">
            <div className="section">
              <h3>{t('Examples')}</h3>
              <select
                aria-label={t('Examples')}
                value=""
                onChange={(e) => {
                  const p = PRESETS[+e.target.value]
                  if (p) setS((o) => ({ ...DEFAULT_STATE, lang: o.lang, theme: o.theme, ...p.state }))
                  setSel(0)
                }}
              >
                <option value="">{t('Pick an example…')}</option>
                {PRESETS.map((p, i) => (
                  <option key={p.name} value={i}>{t(p.name)}</option>
                ))}
              </select>
            </div>

            <div className="section">
              <h3>{t('Design')}</h3>
              <div className="seg" role="tablist" aria-label={t('Design')}>
                {MODES.map((m) => (
                  <button key={m} role="tab" aria-selected={s.mode === m} className={s.mode === m ? 'on' : ''} onClick={() => (set({ mode: m }), setSel(0))}>
                    {t(MODE_LABEL[m])}
                  </button>
                ))}
              </div>
              <p className="hint">{t(MODE_HINT[s.mode])}</p>
              <div className="grid2">
                <ValueField label={vinLabel} unit="V" value={s.vin} bad={bad.has('vin')} onChange={(v) => set({ vin: v })} />
                {s.mode === 'divider' && <ValueField label={t('Wanted output')} unit="V" value={s.vout} bad={bad.has('vout')} onChange={(v) => set({ vout: v })} />}
                {s.mode === 'ratio' && <ValueField label={t('Vout / Vin')} value={s.ratio} bad={bad.has('ratio')} onChange={(v) => set({ ratio: v })} />}
                {s.mode === 'adc' && <ValueField label={t('ADC reference')} unit="V" value={s.adcVref} bad={bad.has('adcVref')} onChange={(v) => set({ adcVref: v })} />}
                {s.mode === 'adc' && <ValueField label={t('ADC bits')} value={s.adcBits} bad={bad.has('adcBits')} onChange={(v) => set({ adcBits: v })} />}
                {feedback && <ValueField label={t('Reference Vref')} unit="V" value={s.vref} bad={bad.has('vref')} onChange={(v) => set({ vref: v })} />}
                {!feedback && <ValueField label={t('Load across R2')} unit="Ω" placeholder={t('none')} title={t('Leave empty for an unloaded divider. 100k, 4k7 and 1M work.')} value={s.load} bad={bad.has('load')} onChange={(v) => set({ load: v })} />}
              </div>
              {(feedback || s.mode === 'adc') && (
                <div className="chips" aria-label={t('Common references')}>
                  {COMMON_VREFS.map((c) => (
                    <button key={c.v} className="small" onClick={() => set(feedback ? { vref: String(c.v) } : { adcVref: String(c.v) })}>
                      {c.label} V
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="section">
              <h3>{t('Parts')}</h3>
              <div className="grid2">
                <label className="field">
                  <span>{t('E-series')}</span>
                  <select value={s.series} onChange={(e) => set(applySeries(s, e.target.value as Series))}>
                    {SERIES.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <ValueField label={t('Tolerance')} unit="%" value={s.tolPct} bad={bad.has('tolPct')} onChange={(v) => set({ tolPct: v })} />
              </div>
              <label className="check">
                <input type="checkbox" checked={s.combos} onChange={(e) => set({ combos: e.target.checked })} />
                <span>{t('Allow two resistors in series or parallel')}</span>
              </label>
              <div className="grid2">
                <ValueField label={t('Smallest resistor')} unit="Ω" value={s.rMin} bad={bad.has('rMin')} onChange={(v) => set({ rMin: v })} />
                <ValueField label={t('Largest resistor')} unit="Ω" value={s.rMax} bad={bad.has('rMax')} onChange={(v) => set({ rMax: v })} />
                <ValueField label={t('Min R1 + R2')} unit="Ω" placeholder={t('any')} value={s.totalMin} bad={bad.has('totalMin')} onChange={(v) => set({ totalMin: v })} />
                <ValueField label={t('Max R1 + R2')} unit="Ω" placeholder={t('any')} value={s.totalMax} bad={bad.has('totalMax')} onChange={(v) => set({ totalMax: v })} />
                <ValueField label={t('Max current')} unit="mA" placeholder={t('any')} value={s.maxCurrentMa} bad={bad.has('maxCurrentMa')} onChange={(v) => set({ maxCurrentMa: v })} />
              </div>
            </div>

            <div className="section">
              <h3>{t('Tolerance analysis')}</h3>
              <div className="grid2">
                <ValueField label={feedback ? t('Vref tolerance') : t('Vin tolerance')} unit="%" value={s.srcTolPct} bad={bad.has('srcTolPct')} onChange={(v) => set({ srcTolPct: v })} />
                <ValueField label={t('Accept Vout within ±')} unit="%" value={s.passPct} bad={bad.has('passPct')} onChange={(v) => set({ passPct: v })} />
                <label className="field">
                  <span>{t('Monte Carlo spread')}</span>
                  <select value={s.dist} onChange={(e) => set({ dist: e.target.value as AppState['dist'] })}>
                    <option value="uniform">{t('Uniform in tolerance')}</option>
                    <option value="gaussian">{t('Gaussian (tolerance = 3σ)')}</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="section">
              <h3>{t('Check your own values')}</h3>
              <div className="grid2">
                <ValueField label="R1" unit="Ω" placeholder="10k" value={s.customR1} bad={customBad && !(parseR(s.customR1) > 0)} onChange={(v) => set({ customR1: v })} />
                <ValueField label="R2" unit="Ω" placeholder="4k7" value={s.customR2} bad={customBad && !(parseR(s.customR2) > 0)} onChange={(v) => set({ customR2: v })} />
              </div>
              <button disabled={!custom || !parsed.ok} onClick={() => setSel(-1)}>{t('Analyse this pair')}</button>
            </div>

            <div className="section">
              <h3>{t('Settings')}</h3>
              <div className="grid2">
                <label className="field">
                  <span>{t('Language')}</span>
                  <select value={s.lang} onChange={(e) => set({ lang: e.target.value as AppState['lang'] })}>
                    <option value="en">English</option>
                    <option value="uk">Українська</option>
                  </select>
                </label>
                <label className="field">
                  <span>{t('Theme')}</span>
                  <select value={s.theme} onChange={(e) => set({ theme: e.target.value as AppState['theme'] })}>
                    <option value="auto">{t('System')}</option>
                    <option value="light">{t('Light')}</option>
                    <option value="dark">{t('Dark')}</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </aside>

        <main className="main">
          <section className="box">
            <h3>{t('Best pairs')}</h3>
            {!parsed.ok && <p className="verdict err">{t('Fix the highlighted fields.')}</p>}
            {parsed.ok && finder.state === 'pending' && <p className="hint">{t('Searching…')}</p>}
            {finder.state === 'error' && <p className="verdict err">{t('Error: {0}', finder.message)}</p>}
            {parsed.ok && finder.state === 'done' && results.length === 0 && (
              <p className="verdict warn">{t('No pair satisfies the constraints. Widen the resistor range or the limits.')}</p>
            )}
            {results.length > 0 && (
              <>
                <p className="hint">
                  {t('Target')}: <b>{formatV(parsed.ok ? parsed.target : 0)}</b>
                  {parsed.ok && !feedback && s.mode !== 'ratio' && parsed.spec.ratio > 0 ? ` (${t('ratio')} ${+parsed.spec.ratio.toPrecision(5)})` : ''}
                </p>
                <div className="scroll">
                  <table className="data results">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>R1</th>
                        <th>R2</th>
                        <th>{t('Vout')}</th>
                        <th>{t('Error')}</th>
                        <th>{t('Current')}</th>
                        <th>{t('Power')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={`${r.r1.value}|${r.r2.value}`} className={!chosen?.custom && i === Math.min(sel, results.length - 1) ? 'active' : ''} onClick={() => setSel(i)} tabIndex={0}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSel(i))}>
                          <td>{i + 1}</td>
                          <td>{comboText(r.r1)}</td>
                          <td>{comboText(r.r2)}</td>
                          <td>{formatV(r.vout)}</td>
                          <td className={errClass(r.error)}>{formatPct(r.error * 100)}</td>
                          <td>{formatCurrent(r.current)}</td>
                          <td>{formatPower(r.pR1 + r.pR2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {chosen && detail && parsed.ok && (
            <section className="box detail">
              <div className="row">
                <h3>{chosen.custom ? t('Your pair') : t('Selected pair')}</h3>
                <span className="spacer" />
                <button className="small" onClick={copy}>{copied ? t('Copied') : t('Copy values')}</button>
              </div>
              <div className="detail-grid">
                <Schematic
                  feedback={feedback}
                  r1={chosen.r1}
                  r2={chosen.r2}
                  load={parsed.spec.load}
                  vinLabel={`Vin ${formatV(parsed.spec.vin)}`}
                  voutLabel={`Vout ${formatV(detail.ev.vout)}`}
                  topLabel={`Vout ${formatV(parsed.spec.vin)}`}
                  midLabel={`FB ${formatV(parsed.spec.vref)}`}
                  title={t('Divider schematic')}
                />
                <table className="data kv">
                  <tbody>
                    <tr><td>R1</td><td>{comboText(chosen.r1)} Ω</td></tr>
                    <tr><td>R2</td><td>{comboText(chosen.r2)} Ω</td></tr>
                    <tr><td>{t('Output voltage')}</td><td><b>{formatV(detail.ev.vout)}</b> <span className={errClass(detail.ev.error)}>({formatPct(detail.ev.error * 100)})</span></td></tr>
                    {!feedback && Number.isFinite(parsed.spec.load) && <tr><td>{t('Without the load')}</td><td>{formatV(detail.ev.voutUnloaded)}</td></tr>}
                    {!feedback && <tr><td>{t('Ratio Vout / Vin')}</td><td>{+detail.ev.ratio.toPrecision(6)} (1 : {+(1 / detail.ev.ratio).toPrecision(5)})</td></tr>}
                    <tr><td>{t('Divider current')}</td><td>{formatCurrent(detail.ev.current)}</td></tr>
                    <tr><td>{t('Power in R1')}</td><td>{formatPower(detail.ev.pR1)}</td></tr>
                    <tr><td>{t('Power in R2')}</td><td>{formatPower(detail.ev.pR2)}</td></tr>
                    <tr>
                      <td>{s.mode === 'adc' ? t('Source impedance at the ADC') : t('Output impedance')}</td>
                      <td>{formatR(detail.ev.zOut)} Ω{s.mode === 'adc' && detail.ev.zOut > 10000 ? <span className="warn-text"> · {t('many ADCs want 10 kΩ or less')}</span> : null}</td>
                    </tr>
                    {s.mode === 'adc' && Number.isFinite(parsed.lsb) && (
                      <tr><td>{t('Error in ADC steps')}</td><td>{+((detail.ev.vout - detail.ev.target) / parsed.lsb).toPrecision(3)} LSB</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <h3>{t('Tolerance')}</h3>
              <p className="hint">
                {t('Resistors ±{0}%', +(parsed.tol * 100).toPrecision(3))}
                {parsed.srcTol > 0 ? `, ${feedback ? 'Vref' : 'Vin'} ±${+(parsed.srcTol * 100).toPrecision(3)}%` : ''}
              </p>
              <table className="data kv">
                <tbody>
                  <tr>
                    <td>{t('Worst case')}</td>
                    <td>
                      {formatV(detail.wc.min)} … {formatV(detail.wc.max)}{' '}
                      <span className="muted">({formatPct(detail.wc.minError * 100)} … {formatPct(detail.wc.maxError * 100)})</span>
                    </td>
                  </tr>
                  <tr><td>{t('Monte Carlo mean ± σ')}</td><td>{formatV(detail.mc.mean)} ± {formatV(detail.mc.std)}</td></tr>
                  <tr><td>{t('95% of units between')}</td><td>{formatV(detail.mc.p025)} … {formatV(detail.mc.p975)}</td></tr>
                  <tr>
                    <td>{t('Within ±{0}% of target', +(parsed.passBand * 100).toPrecision(3))}</td>
                    <td><b className={detail.mc.pass > 0.99 ? 'ok-text' : detail.mc.pass > 0.9 ? 'warn-text' : 'err-text'}>{(detail.mc.pass * 100).toFixed(1)}%</b> {t('of {0} simulated units', detail.mc.n)}</td>
                  </tr>
                </tbody>
              </table>
              <Histogram mc={detail.mc} target={detail.target} passBand={parsed.passBand} worstMin={detail.wc.min} worstMax={detail.wc.max} title={t('Histogram of simulated output voltage')} />
              <p className="hint">{t('Dashed line: target. Green band: accepted range. Red ticks: worst case.')}</p>
            </section>
          )}
        </main>
      </div>
      <p className="hint foot">
        {t('Everything runs in your browser. Check power ratings and real-part behaviour before building.')}{' '}
        <a href="https://github.com/hermes98761234/voltage-divider-finder">{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}

