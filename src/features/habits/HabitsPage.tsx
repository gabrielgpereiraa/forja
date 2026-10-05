import { useMemo, useState } from 'react'
import { Archive, ChevronDown, Flame, Plus, Repeat } from 'lucide-react'

import { HabitGlyph, habitColorStyle } from '@/components/appearance'
import { EmptyState, PageHeader, Surface } from '@/components/layout'
import { ProgressBar } from '@/components/progress/progress-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { HABIT_CATEGORIES } from '@/domain/models/habit'
import { habitWeekStreak } from '@/domain/rules/habit-schedule'
import { useCurrentWeekStart, useLogIndex, useProgressionSuggestions, useWeekOverview } from '@/hooks/use-domain'
import { useToday } from '@/hooks/use-today'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { formatSchedule, formatTarget } from './habit-format'
import { HABIT_TEMPLATES } from './habit-templates'
import { ProgressionCard } from './ProgressionCard'
import { WeekStrip } from './WeekStrip'

export function HabitsPage() {
  const today = useToday()
  const weekStart = useCurrentWeekStart(today)
  const week = useWeekOverview(weekStart, today)
  const habits = useAppStore((s) => s.habits)
  const logs = useLogIndex()
  const { openHabitForm, openHabitLog } = useUiStore()
  const [showArchived, setShowArchived] = useState(false)

  const suggestions = useProgressionSuggestions(today)
  const archived = useMemo(() => habits.filter((h) => h.archived), [habits])
  const streaks = useMemo(() => new Map(week.habits.map((r) => [r.habit.id, habitWeekStreak(r.habit, today, logs)])), [week.habits, today, logs])
  const ratio = week.sessionsGoal ? week.sessionsDone / week.sessionsGoal : 0

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Hábitos"
        subtitle="Compromissos recorrentes, medidos pela frequência semanal."
        actions={
          <Button onClick={() => openHabitForm()} className="hidden md:inline-flex">
            <Plus /> Novo hábito
          </Button>
        }
      />

      {week.habits.length === 0 ? (
        <EmptyState icon={Repeat} title="Nenhum hábito ativo" description="Crie hábitos para acompanhar sua frequência semanal e evoluir seus atributos.">
          {HABIT_TEMPLATES.slice(0, 5).map((t) => (
            <Button key={t.name} variant="outline" size="sm" onClick={() => openHabitForm(null, t)}>
              {t.name}
            </Button>
          ))}
          <Button size="sm" onClick={() => openHabitForm()}>
            <Plus /> Criar
          </Button>
        </EmptyState>
      ) : (
        <>
          <Surface className="mb-5 p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Semana atual</div>
                <div className="mt-1 font-display text-2xl font-semibold tabular">
                  {week.sessionsDone}
                  <span className="text-base text-muted-foreground"> / {week.sessionsGoal} sessões</span>
                </div>
              </div>
              <div className="text-right text-[13px] text-muted-foreground">
                <span className="font-semibold text-foreground tabular">{week.goalsMet}</span> de {week.habits.length} metas batidas
              </div>
            </div>
            <ProgressBar value={ratio} size="md" className="mt-3" />
          </Surface>

          {suggestions.length > 0 && (
            <section className="mb-5 space-y-2" aria-label="Sugestões de progressão">
              <h2 className="px-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Evolução das metas</h2>
              {suggestions.map((s) => {
                const h = habits.find((x) => x.id === s.habitId)
                return h ? <ProgressionCard key={s.habitId} suggestion={s} habit={h} today={today} /> : null
              })}
            </section>
          )}

          <ul className="grid gap-2.5 sm:grid-cols-2">
            {week.habits.map((row) => {
              const { habit, progress } = row
              const met = progress.goal > 0 && progress.done >= progress.goal
              const streak = streaks.get(habit.id) ?? 0
              const target = formatTarget(habit.target)
              return (
                <li key={habit.id}>
                  <button
                    type="button"
                    onClick={() => openHabitLog(habit.id, today)}
                    style={habitColorStyle(habit.color)}
                    className="habit-color group w-full rounded-2xl border bg-card p-4 text-left transition-colors hover:border-[color-mix(in_oklch,var(--hc)_35%,transparent)]"
                  >
                    <div className="flex items-start gap-3">
                      <HabitGlyph icon={habit.icon} color={habit.color} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[15px] font-semibold">{habit.name}</span>
                          {met && <Badge variant="success">{progress.done > progress.goal ? 'Excedida' : 'Meta batida'}</Badge>}
                        </div>
                        <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                          {formatSchedule(habit)}
                          {target && ` · ${target}`} · {HABIT_CATEGORIES[habit.category].label}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-lg leading-none font-semibold tabular">
                          {progress.done}
                          <span className="text-sm text-muted-foreground">/{progress.goal}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3.5">
                      <WeekStrip marks={row.marks} today={today} size="sm" />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[12px] text-muted-foreground">
                      <span className={cn('inline-flex items-center gap-1', streak > 0 && 'text-xp')}>
                        <Flame className="size-3.5" />
                        {streak > 0 ? (streak === 1 ? '1 semana com meta batida' : `${streak} semanas seguidas`) : 'Sem sequência ainda'}
                      </span>
                      <span>
                        {progress.goal - progress.done > 0 ? `Faltam ${progress.goal - progress.done}` : 'Concluída'}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-2 px-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
            aria-expanded={showArchived}
          >
            <Archive className="size-4" /> Arquivados · {archived.length}
            <ChevronDown className={cn('size-4 transition-transform', showArchived && 'rotate-180')} />
          </button>
          {showArchived && (
            <Surface className="mt-2 p-1.5">
              {archived.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => openHabitForm(h.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left opacity-70 hover:bg-accent/50 hover:opacity-100"
                >
                  <HabitGlyph icon={h.icon} color={h.color} size="sm" />
                  <span className="flex-1 truncate text-sm">{h.name}</span>
                  <span className="text-[12px] text-muted-foreground">Reativar</span>
                </button>
              ))}
            </Surface>
          )}
        </div>
      )}
    </div>
  )
}
