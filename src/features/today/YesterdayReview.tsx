import { useState } from 'react'
import { CalendarClock, ChevronDown, Moon } from 'lucide-react'

import { Surface } from '@/components/layout'
import { ScorePill } from '@/components/score'
import { Button } from '@/components/ui/button'
import type { DayOverview } from '@/domain/rules/day-overview'
import { habitsForMorningReview } from '@/domain/rules/late-confirmation'
import { cn, formatNumber, pluralize } from '@/lib/utils'
import { useUiStore } from '@/store/ui-store'
import { useHabitActions } from '@/features/feedback/use-actions'
import { HabitTodayRow } from '@/features/habits/HabitTodayRow'

/**
 * Revisão da manhã: ontem ainda está aberto. Confirme o que só dá para saber
 * depois (ex.: dormir até 23h) e encerre ontem. Só hábitos com "Confirmar na
 * manhã seguinte" podem ser marcados; tarefas pendentes seguem para hoje como
 * atrasadas (não dá para concluir tarefas no passado).
 */
export function YesterdayReview({ overview, onComplete }: { overview: DayOverview; onComplete: () => void }) {
  const yesterday = overview.date
  const openHabitLog = useUiStore((s) => s.openHabitLog)
  const habitActions = useHabitActions()
  const [expanded, setExpanded] = useState(true)

  // Só hábitos com "Confirmar na manhã seguinte" (hábitos comuns pendentes não entram).
  const allHabits = habitsForMorningReview(overview)
  // Lista estável: o que estava pendente quando a revisão abriu continua
  // visível depois de marcado (sem itens "pulando" da tela).
  const [initial] = useState(() => new Set(allHabits.map((h) => h.habit.id)))

  const habits = allHabits.filter((h) => initial.has(h.habit.id))
  const confirmCount = habits.filter((h) => h.habit.confirmNextDay).length
  const doneAlready = overview.doneItems
  const score = overview.breakdown.score

  return (
    <Surface className="mb-6 overflow-hidden border-primary/25 animate-rise">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          {confirmCount > 0 ? <Moon className="size-5" /> : <CalendarClock className="size-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Ontem ainda está aberto</span>
          <span className="block text-[13px] text-muted-foreground">
            {confirmCount > 0
              ? 'Confirme o que só dava para saber hoje e encerre o dia.'
              : 'Revise a nota e encerre o dia.'}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <ScorePill score={score} live />
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </span>
      </button>

      {expanded && (
        <>
          {habits.length > 0 && (
            <div className="border-t p-1.5">
              {habits.map((s) => (
                <HabitTodayRow
                  key={s.habit.id}
                  state={s}
                  hint={s.habit.confirmNextDay ? (s.doneToday ? 'Confirmado' : 'Confirmar') : undefined}
                  onToggle={() => habitActions.toggle(s.habit.id, yesterday)}
                  onOpen={() => openHabitLog(s.habit.id, yesterday)}
                />
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2 border-t bg-surface/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="px-1 text-[12px] text-muted-foreground">
              {doneAlready > 0 && `${pluralize(doneAlready, 'item já concluído', 'itens já concluídos')} · `}
              Se não encerrar, ele fecha sozinho amanhã.
            </p>
            <Button onClick={onComplete} className="shrink-0">
              Encerrar ontem{score !== null && ` · ${formatNumber(score, 1)}`}
            </Button>
          </div>
        </>
      )}

    </Surface>
  )
}
