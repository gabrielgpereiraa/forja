import { Minus, Plus } from 'lucide-react'

import { ProgressBar } from '@/components/progress/progress-bar'
import { tierColor } from '@/components/score'
import type { ScoreBreakdown } from '@/domain/scoring'
import { cn, formatNumber } from '@/lib/utils'

/** Explica a nota: componentes ponderados + bônus/penalidades. */
export function ScoreBreakdownView({ breakdown, className }: { breakdown: ScoreBreakdown; className?: string }) {
  const color = tierColor(breakdown.score)
  const active = breakdown.components.filter((c) => !c.skipped)
  const weightSum = active.reduce((s, c) => s + c.weight, 0)

  if (breakdown.score === null) {
    return <p className={cn('text-sm text-muted-foreground', className)}>Nada estava planejado neste dia — ele não afeta sua média nem sua sequência.</p>
  }

  return (
    <div className={cn('space-y-3', className)}>
      <ul className="space-y-3">
        {breakdown.components.map((c) => (
          <li key={c.id} className={cn(c.skipped && 'opacity-50')}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
              <span className="font-medium">
                {c.label}
                {!c.skipped && weightSum > 0 && (
                  <span className="ml-1.5 text-[11px] font-normal text-muted-foreground tabular">peso {Math.round((c.weight / weightSum) * 100)}%</span>
                )}
              </span>
              <span className="text-muted-foreground tabular">{c.detail}</span>
            </div>
            <ProgressBar value={c.skipped ? 0 : c.ratio} color={color} />
          </li>
        ))}
      </ul>
      {breakdown.adjustments.length > 0 && (
        <ul className="space-y-1.5 border-t pt-3">
          {breakdown.adjustments.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span
                  className={cn(
                    'flex size-4 items-center justify-center rounded-full',
                    a.kind === 'bonus' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger',
                  )}
                >
                  {a.kind === 'bonus' ? <Plus className="size-2.5" strokeWidth={3} /> : <Minus className="size-2.5" strokeWidth={3} />}
                </span>
                {a.label}
              </span>
              <span className={cn('font-medium tabular', a.kind === 'bonus' ? 'text-success' : 'text-danger')}>
                {a.value > 0 ? '+' : ''}
                {formatNumber(a.value, 2)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t pt-3 text-[13px]">
        <span className="text-muted-foreground">Base {formatNumber(breakdown.base ?? 0, 1)} · {Math.round(breakdown.completion * 100)}% da meta diária</span>
        <span className="font-semibold tabular">{formatNumber(breakdown.score, 1)} / 10</span>
      </div>
    </div>
  )
}
