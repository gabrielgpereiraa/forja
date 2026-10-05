import { useState } from 'react'

import { formatDate } from '@/domain/date'
import type { SkillDay } from '@/domain/skills/engine'
import { useElementWidth } from '@/hooks/use-element-width'

const H = 132
const PAD = { top: 10, right: 6, bottom: 20, left: 26 }

/**
 * Condição nos últimos N dias (uma série, um eixo 0–100) com a linha do piso.
 * Dias de prática marcados na base. Crosshair + tooltip ao tocar/passar.
 */
export function SkillConditionChart({ days, floor }: { days: SkillDay[]; floor: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const n = days.length
  const w = Math.max(0, width - PAD.left - PAD.right)
  const h = H - PAD.top - PAD.bottom
  const x = (i: number) => PAD.left + (n <= 1 ? w / 2 : (i / (n - 1)) * w)
  const y = (v: number) => PAD.top + h - (v / 100) * h
  const path = days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.condition).toFixed(1)}`).join('')
  const area = n ? `${path}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : ''
  const hd = hover !== null ? days[hover] : null

  const move = (clientX: number, rect: DOMRect) => {
    const i = Math.round(((clientX - rect.left - PAD.left) / Math.max(1, w)) * (n - 1))
    setHover(Math.max(0, Math.min(n - 1, i)))
  }

  return (
    <div ref={ref} className="relative select-none" style={{ height: H }}>
      {width > 0 && n > 0 && (
        <svg
          width={width}
          height={H}
          role="img"
          aria-label={`Condição nos últimos ${n} dias`}
          className="touch-pan-y"
          onPointerMove={(e) => move(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerDown={(e) => move(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + w} y1={y(v)} y2={y(v)} className="stroke-border" />
              <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted-foreground/70 text-[10px]">
                {v}
              </text>
            </g>
          ))}
          <line x1={PAD.left} x2={PAD.left + w} y1={y(floor)} y2={y(floor)} stroke="var(--rust-color)" strokeOpacity={0.55} />
          <text x={PAD.left + w} y={y(floor) - 4} textAnchor="end" className="text-[9px]" fill="var(--rust-color)">
            piso {floor}%
          </text>
          <path d={area} fill="var(--skill-bar)" opacity={0.1} />
          <path d={path} fill="none" stroke="var(--skill-bar)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {days.map((d, i) => (d.effort > 0 ? <rect key={d.date} x={x(i) - 1} y={y(0) - 3} width={2} height={3} rx={1} fill="var(--skill-bar)" /> : null))}
          <text x={PAD.left} y={H - 5} className="fill-muted-foreground/70 text-[10px]">
            {formatDate(days[0]!.date, 'd MMM')}
          </text>
          <text x={PAD.left + w} y={H - 5} textAnchor="end" className="fill-muted-foreground/70 text-[10px]">
            hoje
          </text>
          {hd && hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + h} className="stroke-muted-foreground/40" />
              <circle cx={x(hover)} cy={y(hd.condition)} r={4} fill="var(--skill-bar)" className="stroke-card" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {hd && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-36 rounded-xl border bg-popover px-2.5 py-2 text-[12px] shadow-lg"
          style={{ left: Math.min(Math.max(x(hover) - 72, 0), Math.max(0, width - 144)) }}
        >
          <div className="font-medium">{formatDate(hd.date, "EEE, d 'de' MMM")}</div>
          <div className="mt-1 flex justify-between text-muted-foreground">
            Condição <span className="font-semibold text-foreground tabular">{Math.round(hd.condition)}%</span>
          </div>
          {hd.effort > 0 ? (
            <div className="flex justify-between text-muted-foreground">
              Prática <span className="text-foreground tabular">{hd.minutes ? `${Math.round(hd.minutes)} min` : 'sim'}</span>
            </div>
          ) : hd.decay > 0 ? (
            <div className="flex justify-between text-muted-foreground">
              Ferrugem <span className="text-foreground tabular">−{hd.decay.toFixed(1)}</span>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
