import { useState } from 'react'
import { ChevronDown, Lock, Moon, X } from 'lucide-react'

import { Surface } from '@/components/layout'
import { ScorePill } from '@/components/score'
import type { ISODate } from '@/domain/date'
import type { HabitDayState } from '@/domain/rules/habit-schedule'
import type { DailyRecord } from '@/domain/models/day'
import { cn, pluralize } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { useHabitActions } from '@/features/feedback/use-actions'
import { HabitTodayRow } from '@/features/habits/HabitTodayRow'
import { lateDeadlineLabel } from './late-window'

/**
 * Ontem já foi encerrado, mas tinha hábitos "Confirmar na manhã seguinte" em
 * aberto. Só eles podem ser confirmados aqui; a conclusão conta para ontem e a
 * nota de ontem é recalculada. Todo o resto de ontem continua travado.
 */
export function LateConfirmationCard({
  date,
  today,
  record,
  states,
  confirmed,
  onDismiss,
}: {
  date: ISODate
  today: ISODate
  record: DailyRecord
  states: HabitDayState[]
  confirmed: ReadonlySet<string>
  onDismiss: () => void
}) {
  const dayStartHour = useAppStore((s) => s.settings.dayStartHour)
  const openHabitLog = useUiStore((s) => s.openHabitLog)
  const { confirmLate } = useHabitActions()
  const [expanded, setExpanded] = useState(true)
  // Lista estável enquanto o cartão está aberto (itens não "pulam" ao confirmar).
  const [ids] = useState(() => new Set(states.map((s) => s.habit.id)))
  const items = states.filter((s) => ids.has(s.habit.id))
  const open = items.filter((s) => !confirmed.has(s.habit.id)).length

  return (
    <Surface className="mb-6 overflow-hidden border-primary/25 animate-rise">
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Moon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Confirme o que só dava para saber hoje</span>
            <span className="block text-[13px] text-muted-foreground">
              {open > 0
                ? `${pluralize(open, 'hábito de ontem aguarda', 'hábitos de ontem aguardam')} confirmação — ${lateDeadlineLabel(dayStartHour)}.`
                : 'Tudo confirmado. A nota de ontem foi recalculada.'}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <ScorePill score={record.score} />
            <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
          </span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="-m-1 rounded-lg p-1 text-muted-foreground hover:bg-accent"
          aria-label="Dispensar — não cumpri"
          title="Não cumpri"
        >
          <X className="size-4" />
        </button>
      </div>

      {expanded && (
        <>
          <div className="border-t p-1.5">
            {items.map((s) => {
              const isConfirmed = confirmed.has(s.habit.id)
              return (
                <HabitTodayRow
                  key={s.habit.id}
                  state={s}
                  hint={isConfirmed ? 'Confirmado' : 'Confirmar'}
                  onToggle={() => confirmLate(s.habit.id, date, today, !s.doneToday)}
                  onOpen={() => openHabitLog(s.habit.id, date)}
                />
              )
            })}
          </div>
          <p className="flex items-center gap-1.5 border-t bg-surface/50 px-4 py-3 text-[12px] text-muted-foreground">
            <Lock className="size-3.5 shrink-0" />
            Ontem segue encerrado: só estes hábitos podem ser confirmados, e contam para ontem.
          </p>
        </>
      )}
    </Surface>
  )
}
