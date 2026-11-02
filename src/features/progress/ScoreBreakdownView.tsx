import { useMemo } from 'react'
import { Minus, Plus } from 'lucide-react'

import { ProgressBar } from '@/components/progress/progress-bar'
import { tierColor } from '@/components/score'
import type { ScoreBreakdown, ScoreItem } from '@/domain/scoring'
import { cn, formatNumber } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { scoreItemLabel } from './score-items'
import { ScoreValueChip } from './ScoreValueChip'

/** Itens da nota v2 agrupados, com o valor e o ganho de cada um. */
function ScoreItemsList({ items }: { items: ScoreItem[] }) {
  const habits = useAppStore((s) => s.habits)
  const tasks = useAppStore((s) => s.tasks)
  const names = useMemo(() => {
    const m = new Map<string, string>()
    for (const h of habits) m.set(`habit:${h.id}`, h.name)
    for (const t of tasks) m.set(`task:${t.id}`, t.title)
    return m
  }, [habits, tasks])
  const groups: { title: string; items: ScoreItem[] }[] = [
    { title: 'Hábitos exigidos', items: items.filter((i) => i.role === 'required') },
    { title: 'Tarefas', items: items.filter((i) => i.role === 'due' || i.role === 'overdue') },
    { title: 'Bônus', items: items.filter((i) => i.role === 'optional' || i.role === 'early') },
  ].filter((g) => g.items.length > 0)

  return (
    <div className="space-y-3 border-t pt-3">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{g.title}</div>
          <ul className="space-y-1">
            {g.items.map((item, i) => {
              const name = (item.id && names.get(`${item.kind}:${item.id}`)) || (item.kind === 'habit' ? 'Hábito removido' : 'Tarefa removida')
              return (
                <li key={`${item.kind}:${item.id ?? i}`} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="min-w-0 truncate">
                    {name}
                    {item.role === 'overdue' && <span className="text-muted-foreground"> · atrasada</span>}
                  </span>
                  <ScoreValueChip label={scoreItemLabel(item)} />
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Explica a nota: componentes ponderados + bônus/penalidades (v2: também os itens). */
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
      {breakdown.items && <ScoreItemsList items={breakdown.items} />}
      {breakdown.taskCap?.active && (
        <p className="text-[12px] text-muted-foreground">
          Hoje há mais tarefas do que hábitos exigidos: as tarefas valem até metade da nota base, mantendo a proporção entre prioridades.
        </p>
      )}
      <div className="flex items-center justify-between border-t pt-3 text-[13px]">
        <span className="text-muted-foreground">
          Base {formatNumber(breakdown.base ?? 0, 1)} · {Math.round(breakdown.completion * 100)}% {breakdown.items ? 'do plano' : 'da meta diária'}
          {breakdown.score < 10 && ` · faltam ${formatNumber(10 - breakdown.score, 1)} para 10`}
        </span>
        <span className="font-semibold tabular">{formatNumber(breakdown.score, 1)} / 10</span>
      </div>
      <div className="text-[11px] text-muted-foreground/80">Regra da nota: {breakdown.version}</div>
    </div>
  )
}
