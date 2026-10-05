import { useState } from 'react'
import { ChevronLeft, ChevronRight, ListTodo, Repeat, Star } from 'lucide-react'

import { HabitGlyph, habitColorStyle } from '@/components/appearance'
import { StatTile, Surface } from '@/components/layout'
import { ProgressBar } from '@/components/progress/progress-bar'
import { ScorePill } from '@/components/score'
import { Button } from '@/components/ui/button'
import { addDays, capitalize, formatDate, startOfWeek, type ISODate } from '@/domain/date'
import { useWeekOverview } from '@/hooks/use-domain'
import { formatScore, pluralize } from '@/lib/utils'
import { useUiStore } from '@/store/ui-store'
import { WeekStrip } from '@/features/habits/WeekStrip'
import { WeekScoreBars } from './WeekScoreBars'

export function WeekView({ today }: { today: ISODate }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today))
  const [selected, setSelected] = useState<ISODate | null>(today)
  const week = useWeekOverview(weekStart, today)
  const openDayDetail = useUiStore((s) => s.openDayDetail)
  const isCurrent = weekStart === startOfWeek(today)
  const sel = week.days.find((d) => d.date === selected) ?? null

  const range = `${formatDate(weekStart, 'd MMM')} – ${formatDate(addDays(weekStart, 6), 'd MMM')}`

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="Semana anterior" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft />
        </Button>
        <div className="text-center">
          <div className="text-[15px] font-semibold">{isCurrent ? 'Esta semana' : range}</div>
          {isCurrent && <div className="text-[12px] text-muted-foreground">{range}</div>}
        </div>
        <Button variant="ghost" size="icon" aria-label="Próxima semana" disabled={isCurrent} onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <ChevronRight />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile icon={Star} label="Média" value={formatScore(week.averageScore)} accent="var(--xp)" />
        <StatTile icon={Repeat} label="Sessões" value={`${week.sessionsDone}/${week.sessionsGoal}`} />
        <StatTile icon={ListTodo} label="Tarefas" value={`${week.tasksDone}/${week.tasksTotal}`} />
      </div>

      <Surface className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-muted-foreground">Desempenho diário</h3>
          <span className="text-[12px] text-muted-foreground">nota 0–10</span>
        </div>
        <WeekScoreBars days={week.days} today={today} selected={selected} onSelect={setSelected} />
        {sel && !sel.isFuture && (
          <button
            type="button"
            onClick={() => openDayDetail(sel.date)}
            className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2.5 text-left text-[13px] hover:bg-surface-2"
          >
            <span className="min-w-0">
              <span className="block font-medium">{capitalize(formatDate(sel.date, "EEEE, d 'de' MMM"))}</span>
              <span className="block text-muted-foreground tabular">
                {pluralize(sel.habitsDone, 'hábito', 'hábitos')} · {sel.tasksDone}/{sel.tasksTotal} tarefas
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <ScorePill score={sel.score} live={sel.live} />
              <ChevronRight className="size-4 text-muted-foreground" />
            </span>
          </button>
        )}
      </Surface>

      <section>
        <h3 className="mb-2.5 px-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Metas da semana</h3>
        {week.habits.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhum hábito ativo nesta semana.</p>
        ) : (
          <Surface className="divide-y">
            {week.habits.map(({ habit, progress, marks }) => {
              const ratio = progress.goal ? Math.min(1, progress.done / progress.goal) : 0
              return (
                <div key={habit.id} style={habitColorStyle(habit.color)} className="habit-color space-y-3 p-4">
                  <div className="flex items-center gap-3">
                    <HabitGlyph icon={habit.icon} color={habit.color} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{habit.name}</span>
                    <span className="font-display text-[15px] font-semibold tabular">
                      {progress.done}
                      <span className="text-muted-foreground">/{progress.goal}</span>
                    </span>
                  </div>
                  <ProgressBar value={ratio} color="var(--hc)" size="md" label={`${habit.name}: ${progress.done} de ${progress.goal}`} />
                  <WeekStrip marks={marks} today={today} size="sm" showLetters={false} />
                </div>
              )
            })}
          </Surface>
        )}
      </section>
    </div>
  )
}
