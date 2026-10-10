import { formatV } from '../lib/format'
import type { MonteCarlo } from '../lib/tolerance'

type Props = {
  mc: MonteCarlo
  target: number
  passBand: number
  worstMin: number
  worstMax: number
  title: string
}

/** Histogram of simulated Vout with the target and the accepted band marked. */
export default function Histogram({ mc, target, passBand, worstMin, worstMax, title }: Props) {
  const W = 360
  const H = 150
  const L = 8
  const B = 24
  const lo = Math.min(mc.binMin, target * (1 - passBand), worstMin)
  const hi = Math.max(mc.binMax, target * (1 + passBand), worstMax)
  const span = hi - lo || 1
  const x = (v: number) => L + ((v - lo) / span) * (W - 2 * L)
  const top = Math.max(...mc.bins, 1)
  const bw = ((mc.binMax - mc.binMin) / mc.bins.length / span) * (W - 2 * L)
  return (
    <svg className="histogram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
      <title>{title}</title>
      <rect x={x(target * (1 - passBand))} y="4" width={Math.max(1, x(target * (1 + passBand)) - x(target * (1 - passBand)))} height={H - B - 4} fill="var(--ok)" opacity="0.15" />
      {mc.bins.map((c, i) => {
        const h = (c / top) * (H - B - 10)
        return <rect key={i} x={x(mc.binMin) + i * bw} y={H - B - h} width={Math.max(1, bw - 1)} height={h} fill="var(--accent)" opacity="0.85" />
      })}
      <line x1={x(target)} x2={x(target)} y1="2" y2={H - B} stroke="var(--ref-line)" strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1={x(worstMin)} x2={x(worstMin)} y1={H - B - 14} y2={H - B} stroke="var(--err)" strokeWidth="2" />
      <line x1={x(worstMax)} x2={x(worstMax)} y1={H - B - 14} y2={H - B} stroke="var(--err)" strokeWidth="2" />
      <line x1={L} x2={W - L} y1={H - B} y2={H - B} stroke="var(--grid-strong)" />
      <text x={L} y={H - 8} className="axis" textAnchor="start">{formatV(lo)}</text>
      <text x={x(target)} y={H - 8} className="axis" textAnchor="middle">{formatV(target)}</text>
      <text x={W - L} y={H - 8} className="axis" textAnchor="end">{formatV(hi)}</text>
    </svg>
  )
}
