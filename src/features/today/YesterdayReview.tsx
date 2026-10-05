import { useState } from 'react'
import { CalendarClock, ChevronDown, Moon } from 'lucide-react'

import { Surface } from '@/components/layout'
import { ScorePill } from '@/components/score'
import { Button } from '@/components/ui/button'
import type { DayOverview } from '@/domain/rules/day-overview'
import { cn, formatNumber, pluralize } from '@/lib/utils'
import { useUiStore } from '@/store/ui-store'
import { useHabitActions, useTaskActions } from '@/features/feedback/use-actions'
import { HabitTodayRow } from '@/features/habits/HabitTodayRow'
import { TaskRow } from '@/features/tasks/TaskRow'

/**
 * Revisão da manhã: ontem ainda está aberto. Confirme o que só dá para saber
 * depois (ex.: dormir até 23h) e o que ficou pendente, depois encerre ontem.
 */
export function YesterdayReview({ overview, onComplete }: { overview: DayOverview; onComplete: () => void }) {
  const yesterday = overview.date
  const openHabitLog = useUiStore((s) => s.openHabitLog)
  const openTaskForm = useUiStore((s) => s.openTaskForm)
  const habitActions = useHabitActions()
  const taskActions = useTaskActions()
  const [expanded, setExpanded] = useState(true)

  const allHabits = [...overview.plannedHabits, ...overview.optionalHabits]
  // Lista estável: o que estava pendente quando a revisão abriu continua
  // visível depois de marcado (sem itens "pulando" da tela).
  const [initial] = useState(() => ({
    habits: new Set(
      allHabits.filter((h) => h.habit.confirmNextDay || (h.requirement === 'required' && !h.doneToday)).map((h) => h.habit.id),
    ),
    tasks: new Set(overview.tasks.filter((t) => t.role !== 'bonus' && !t.task.completed).map((t) => t.task.id)),
  }))

  const habits = allHabits
    .filter((h) => initial.habits.has(h.habit.id))
    .sort((a, b) => Number(Boolean(b.habit.confirmNextDay)) - Number(Boolean(a.habit.confirmNextDay)))
  const tasks = overview.tasks.filter((t) => initial.tasks.has(t.task.id))
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
              : 'Marque o que ficou faltando e encerre o dia.'}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <ScorePill score={score} live />
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
        </span>
      </button>

      {expanded && (
        <>
          {(habits.length > 0 || tasks.length > 0) && (
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
              {tasks.map((item) => (
                <TaskRow
                  key={item.task.id}
                  task={item.task}
                  today={yesterday}
                  showDate={false}
                  onToggle={() => taskActions.toggle(item.task.id, yesterday)}
                  onOpen={() => openTaskForm(item.task.id)}
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
