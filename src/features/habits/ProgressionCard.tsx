import { ArrowRight, TrendingDown, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

import { HabitGlyph } from '@/components/appearance'
import { Button } from '@/components/ui/button'
import type { ISODate } from '@/domain/date'
import type { Habit } from '@/domain/models/habit'
import { PROGRESSION, type ProgressionSuggestion } from '@/domain/rules/habit-progression'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { formatGoal } from './habit-format'

function reasonOf(s: ProgressionSuggestion): string {
  if (s.kind === 'increase') {
    return `${PROGRESSION.weeksToIncrease} semanas seguidas batendo a meta. Hora de subir um degrau — ${s.change === 'frequency' ? 'mais uma sessão por semana' : 'um pouco mais por sessão'}.`
  }
  const weeks = s.weeks.map((w) => `${w.done}/${w.goal}`).join(' e ')
  return `Últimas ${PROGRESSION.weeksToDecrease} semanas: ${weeks}. Uma meta menor e constante evolui mais do que uma alta que sempre quebra.`
}

/** Proposta de ajuste de meta: aplicar (vale desta semana em diante) ou adiar 2 semanas. */
export function ProgressionCard({
  suggestion,
  habit,
  today,
  compact = false,
}: {
  suggestion: ProgressionSuggestion
  habit: Habit
  today: ISODate
  compact?: boolean
}) {
  const applyHabitGoal = useAppStore((s) => s.applyHabitGoal)
  const snooze = useAppStore((s) => s.snoozeProgression)
  const up = suggestion.kind === 'increase'
  const Icon = up ? TrendingUp : TrendingDown

  return (
    <div className={cn('rounded-2xl border p-4', up ? 'border-primary/25 bg-primary/6' : 'border-warning/25 bg-warning/6')}>
      <div className="flex items-start gap-3">
        {!compact && <HabitGlyph icon={habit.icon} color={habit.color} />}
        <div className="min-w-0 flex-1">
          {!compact && <div className="truncate text-[15px] font-semibold">{habit.name}</div>}
          <div className={cn('flex items-center gap-1.5 text-[13px] font-semibold', up ? 'text-primary' : 'text-warning')}>
            <Icon className="size-4" />
            {up ? 'Pronto para subir de nível' : 'Ajustar a meta?'}
          </div>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{reasonOf(suggestion)}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[13px]">
            <span className="rounded-lg bg-surface-2 px-2 py-1 text-muted-foreground">{formatGoal(suggestion.current)}</span>
            <ArrowRight className="size-3.5 text-muted-foreground" />
            <span className={cn('rounded-lg px-2 py-1 font-medium', up ? 'bg-primary/15' : 'bg-warning/15')}>{formatGoal(suggestion.proposal)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          variant={up ? 'default' : 'secondary'}
          onClick={() => {
            applyHabitGoal(habit.id, suggestion.proposal, today)
            toast('Meta atualizada', { description: `${habit.name}: ${formatGoal(suggestion.proposal)} · vale a partir desta semana` })
          }}
        >
          Aplicar nova meta
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => {
            snooze(habit.id, today)
            toast('Ok, mantendo a meta atual', { description: 'Volto a sugerir em 2 semanas.' })
          }}
        >
          Agora não
        </Button>
      </div>
    </div>
  )
}
