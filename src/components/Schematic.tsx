import type { Combo } from '../lib/divider'
import { comboText, formatR } from '../lib/format'

type Props = {
  feedback: boolean
  r1: Combo
  r2: Combo
  load: number
  vinLabel: string
  voutLabel: string
  topLabel: string
  midLabel: string
  title: string
}

/** R1 from the top rail to the tap, R2 from the tap to ground, optional load across R2. */
export default function Schematic({ feedback, r1, r2, load, vinLabel, voutLabel, topLabel, midLabel, title }: Props) {
  const hasLoad = Number.isFinite(load)
  const R = (x: number, y: number, label: string, sub?: string) => (
    <g>
      <path d={`M${x} ${y - 8}V${y}`} />
      <rect x={x - 7} y={y} width="14" height="44" fill="var(--panel)" />
      <path d={`M${x} ${y + 44}V${y + 52}`} />
      <text x={x + 14} y={y + 22} className="lab">{label}</text>
      {sub ? <text x={x + 14} y={y + 38} className="sub">{sub}</text> : null}
    </g>
  )
  return (
    <svg className="schematic" viewBox="0 0 340 250" role="img" aria-label={title}>
      <title>{title}</title>
      <g fill="none" stroke="var(--fg)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* top rail */}
        <path d="M60 20H120" />
        <circle cx="60" cy="20" r="3.5" fill="var(--panel)" />
        {R(120, 28, 'R1', comboText(r1))}
        <path d="M120 80V130" />
        <circle cx="120" cy="130" r="3" fill="var(--fg)" />
        <path d="M120 130H300" />
        <circle cx="300" cy="130" r="3.5" fill="var(--panel)" />
        {R(120, 130, 'R2', comboText(r2))}
        {/* ground */}
        <path d="M120 182V198M108 198H132M112 203H128M116 208H124" />
        {hasLoad && (
          <g>
            <path d="M230 130V138" />
            <circle cx="230" cy="130" r="3" fill="var(--fg)" />
            <rect x="223" y="138" width="14" height="44" fill="var(--panel)" />
            <path d="M230 182V198M218 198H242M222 203H238M226 208H234" />
            <text x="246" y="164" className="lab">RL</text>
            <text x="246" y="180" className="sub">{formatR(load)}</text>
          </g>
        )}
      </g>
      <text x="56" y="14" className="lab" textAnchor="end">{feedback ? topLabel : vinLabel}</text>
      <text x="296" y="122" className="lab" textAnchor="end">{feedback ? midLabel : voutLabel}</text>
      {feedback && <text x="296" y="150" className="sub" textAnchor="end">{voutLabel}</text>}
    </svg>
  )
}
