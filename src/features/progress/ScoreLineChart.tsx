import { useState } from 'react'

import { formatDate } from '@/domain/date'
import type { ScorePoint } from '@/domain/rules/history'
import { useElementWidth } from '@/hooks/use-element-width'
import { formatScore } from '@/lib/utils'

const H = 168
const PAD = { top: 12, right: 8, bottom: 22, left: 22 }

/**
 * Evolução da nota: diária (fina, recessiva) + média móvel de 7 dias
 * (cor primária). Um eixo 0–10, grade em linhas finas, crosshair + tooltip.
 */
export function ScoreLineChart({ points }: { points: ScorePoint[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const w = Math.max(0, width - PAD.left - PAD.right)
  const h = H - PAD.top - PAD.bottom
  const n = points.length
  const x = (i: number) => PAD.left + (n <= 1 ? w / 2 : (i / (n - 1)) * w)
  const y = (v: number) => PAD.top + h - (v / 10) * h

  const path = (key: 'score' | 'avg7') => {
    let d = ''
    let pen = false
    points.forEach((p, i) => {
      const v = p[key]
      if (v === null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
      pen = true
    })
    return d
  }

  const onMove = (clientX: number, rect: DOMRect) => {
    const rel = clientX - rect.left - PAD.left
    const i = Math.round((rel / Math.max(w, 1)) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  const hp = hover !== null ? points[hover] : null
  const ticks = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[12px] text-muted-foreground" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full bg-primary" /> Média 7 dias
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full bg-muted-foreground/50" /> Nota diária
        </span>
      </div>
      <div ref={ref} className="relative select-none" style={{ height: H }}>
        {width > 0 && (
          <svg
            width={width}
            height={H}
            role="img"
            aria-label="Evolução da nota diária nos últimos 30 dias"
            className="touch-pan-y"
            onPointerMove={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerDown={(e) => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerLeave={() => setHover(null)}
          >
            {[0, 5, 10].map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={PAD.left + w} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted-foreground/70 text-[10px]">
                  {v}
                </text>
              </g>
            ))}
            {ticks.map((i) => (
              <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="fill-muted-foreground/70 text-[10px]">
                {formatDate(points[i]!.date, 'd MMM')}
              </text>
            ))}
            <path d={path('score')} fill="none" className="stroke-muted-foreground/45" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            <path d={path('avg7')} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {hp && hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + h} className="stroke-muted-foreground/40" strokeWidth={1} />
                {hp.score !== null && <circle cx={x(hover)} cy={y(hp.score)} r={4} className="fill-muted-foreground stroke-card" strokeWidth={2} />}
                {hp.avg7 !== null && <circle cx={x(hover)} cy={y(hp.avg7)} r={4.5} fill="var(--primary)" className="stroke-card" strokeWidth={2} />}
              </g>
            )}
          </svg>
        )}
        {hp && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-xl border bg-popover px-2.5 py-2 text-[12px] shadow-lg"
            style={{ left: Math.min(Math.max(x(hover) - 70, 0), Math.max(0, width - 140)), width: 140 }}
          >
            <div className="font-medium">{formatDate(hp.date, "EEE, d 'de' MMM")}</div>
            <div className="mt-1 flex justify-between text-muted-foreground">
              Nota <span className="font-semibold text-foreground tabular">{formatScore(hp.score)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              Média 7d <span className="font-semibold text-foreground tabular">{formatScore(hp.avg7)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
