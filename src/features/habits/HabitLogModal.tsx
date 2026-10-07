import { useMemo } from 'react'
import { Check, History, Minus, Pencil, Plus, Repeat, Trophy } from 'lucide-react'

import { AnimatedNumber } from '@/components/animated-number'
import { HabitGlyph, habitColorStyle } from '@/components/appearance'
import { SegmentedProgress } from '@/components/progress/progress-bar'
import { ProgressRing } from '@/components/progress/progress-ring'
import { ResponsiveModal } from '@/components/responsive-modal'
import { Button } from '@/components/ui/button'
import { addDays, formatDate, relativeDayLabel, startOfWeek } from '@/domain/date'
import { HABIT_CATEGORIES, TARGET_UNIT_LABEL } from '@/domain/models/habit'
import { ATTRIBUTES } from '@/domain/models/attributes'
import { goalVersions } from '@/domain/rules/habit-goal-history'
import { suggestProgression } from '@/domain/rules/habit-progression'
import { getHabitDayState, habitWeekStreak } from '@/domain/rules/habit-schedule'
import { buildWeekOverview } from '@/domain/rules/week-overview'
import { useLateConfirmable, useLogIndex } from '@/hooks/use-domain'
import { useToday } from '@/hooks/use-today'
import { cn, formatNumber, pluralize } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { useHabitActions } from '@/features/feedback/use-actions'
import { formatGoal, formatSchedule, formatTarget, paceBadge, paceSentence } from './habit-format'
import { ProgressionCard } from './ProgressionCard'
import { WeekStrip } from './WeekStrip'

/** Painel do hábito em um dia: registrar progresso parcial e entender o ritmo da semana. */
export function HabitLogModal() {
  const target = useUiStore((s) => s.habitLog)
  const close = useUiStore((s) => s.closeHabitLog)
  const openHabitForm = useUiStore((s) => s.openHabitForm)
  const habit = useAppStore((s) => (target ? s.habits.find((h) => h.id === target.habitId) ?? null : null))
  const locked = useAppStore((s) => (target ? Boolean(s.records[target.date]) : false))
  const tasks = useAppStore((s) => s.tasks)
  const records = useAppStore((s) => s.records)
  const logs = useLogIndex()
  const today = useToday()
  const actions = useHabitActions()
  const lateMode = useLateConfirmable(target?.habitId ?? null, target?.date ?? null, today)

  const data = useMemo(() => {
    if (!habit || !target) return null
    const state = getHabitDayState(habit, target.date, logs)
    const week = buildWeekOverview({ weekStart: startOfWeek(target.date), today, habits: [habit], logs, tasks, records })
    return {
      state,
      marks: week.habits[0]?.marks ?? [],
      streak: habitWeekStreak(habit, target.date, logs),
      suggestion: suggestProgression(habit, today, logs),
      versions: goalVersions(habit),
    }
  }, [habit, target, logs, today, tasks, records])

  if (!habit || !target || !data) return null

  const { state, marks, streak, suggestion, versions } = data
  const t = habit.target
  const unit = t ? TARGET_UNIT_LABEL[t.unit] : null
  const step = t?.unit === 'minutes' ? 5 : 1
  const quick = t?.unit === 'minutes' ? [5, 10, 15, 30] : t ? [1, 2, 5] : []
  const badge = paceBadge(state)

  return (
    <ResponsiveModal
      open
      onOpenChange={(o) => !o && close()}
      title={
        <span className="flex items-center gap-3">
          <HabitGlyph icon={habit.icon} color={habit.color} />
          <span className="min-w-0">
            <span className="block truncate">{habit.name}</span>
            <span className="block text-[13px] font-normal text-muted-foreground">
              {formatSchedule(habit)}
              {t && ` · ${formatTarget(t)}`}
            </span>
          </span>
        </span>
      }
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" className="text-muted-foreground" onClick={() => { close(); openHabitForm(habit.id) }}>
            <Pencil /> Editar
          </Button>
          <Button variant="secondary" className="flex-1" onClick={close}>
            Fechar
          </Button>
        </div>
      }
    >
      <div style={habitColorStyle(habit.color)} className="habit-color space-y-5">
        {habit.description && <p className="text-sm text-muted-foreground">{habit.description}</p>}

        {/* Registro do dia */}
        <div className="rounded-2xl bg-surface p-4">
          <div className="mb-3 flex items-center justify-between text-[13px]">
            <span className="font-medium">{relativeDayLabel(target.date, today)}</span>
            {locked && <span className="text-muted-foreground">{lateMode ? 'Encerrado · confirmação da manhã seguinte' : 'Dia encerrado'}</span>}
          </div>
          {locked && lateMode ? (
            <div className="space-y-2">
              <Button
                size="lg"
                onClick={() => actions.confirmLate(habit.id, target.date, today, lateMode === 'confirm')}
                className={cn('w-full', lateMode === 'undo' ? 'bg-[var(--hc)] text-[var(--hc-fg)] hover:bg-[var(--hc)]/90' : '')}
                variant={lateMode === 'undo' ? 'default' : 'outline'}
              >
                <Check /> {lateMode === 'undo' ? 'Confirmado — toque para desfazer' : 'Confirmar que cumpri'}
              </Button>
              <p className="text-[12px] text-muted-foreground">Conta para {relativeDayLabel(target.date, today).toLowerCase()}; a nota daquele dia é recalculada.</p>
            </div>
          ) : t && unit ? (
            <div className="flex items-center gap-4">
              <ProgressRing value={state.sessionProgress} size={92} stroke={8} color="var(--hc)">
                <span className="font-display text-2xl leading-none font-semibold tabular">
                  <AnimatedNumber value={state.value} format={(n) => formatNumber(n)} />
                </span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">
                  de {t.amount} {unit.short}
                </span>
              </ProgressRing>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex gap-1.5">
                  <Button variant="outline" size="icon" aria-label="Diminuir" disabled={locked || state.value <= 0} onClick={() => actions.setValue(habit.id, target.date, Math.max(0, state.value - step))}>
                    <Minus />
                  </Button>
                  <Button variant="outline" size="icon" aria-label="Aumentar" disabled={locked} onClick={() => actions.setValue(habit.id, target.date, state.value + step)}>
                    <Plus />
                  </Button>
                  <Button
                    className="flex-1 bg-[var(--hc)] text-[var(--hc-fg)] hover:bg-[var(--hc)]/90"
                    disabled={locked || state.doneToday}
                    onClick={() => actions.setValue(habit.id, target.date, Math.max(t.amount, state.value))}
                  >
                    <Check /> {state.doneToday ? 'Feito' : 'Completar'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quick.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={locked}
                      onClick={() => actions.setValue(habit.id, target.date, state.value + q)}
                      className="h-8 rounded-lg border bg-card px-2.5 text-[13px] font-medium text-muted-foreground tabular hover:text-foreground disabled:opacity-50"
                    >
                      +{q} {unit.short}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <Button
              size="lg"
              disabled={locked}
              onClick={() => actions.toggle(habit.id, target.date)}
              className={cn('w-full', state.doneToday ? 'bg-[var(--hc)] text-[var(--hc-fg)] hover:bg-[var(--hc)]/90' : '')}
              variant={state.doneToday ? 'default' : 'outline'}
            >
              <Check /> {state.doneToday ? 'Concluído — toque para desfazer' : 'Marcar como feito'}
            </Button>
          )}
        </div>

        {/* Semana */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium">Esta semana</span>
            <span className="flex items-center gap-2 text-muted-foreground">
              {badge && <span className={cn(badge.tone === 'danger' && 'text-danger', badge.tone === 'warning' && 'text-warning', badge.tone === 'success' && 'text-success')}>{badge.label} ·</span>}
              {paceSentence(state)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SegmentedProgress done={state.week.done} goal={state.week.goal} color="var(--hc)" size="md" className="flex-1" />
            <span className="font-display text-lg font-semibold tabular">
              {state.week.done}/{state.week.goal}
            </span>
          </div>
          <WeekStrip marks={marks} today={today} />
        </div>

        {suggestion && <ProgressionCard suggestion={suggestion} habit={habit} today={today} compact />}

        <div className="grid grid-cols-2 gap-2 text-[13px]">
          <div className="rounded-2xl border p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Trophy className="size-3.5" /> Semanas seguidas
            </div>
            <div className="mt-1 font-display text-lg font-semibold">{pluralize(streak, 'semana', 'semanas')}</div>
          </div>
          <div className="rounded-2xl border p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Repeat className="size-3.5" /> Atributo
            </div>
            <div className="mt-1 font-display text-lg font-semibold">{ATTRIBUTES[HABIT_CATEGORIES[habit.category].attribute].label}</div>
          </div>
        </div>
        {versions.length > 1 && (
          <div className="text-[13px]">
            <div className="mb-1.5 flex items-center gap-1.5 font-medium">
              <History className="size-3.5 text-muted-foreground" /> Evolução da meta
            </div>
            <ol className="space-y-1">
              {versions
                .map((v, i) => ({ v, next: versions[i + 1] }))
                .reverse()
                .map(({ v, next }) => (
                  <li key={v.from} className={cn('flex justify-between gap-3', next && 'text-muted-foreground')}>
                    <span>
                      {next
                        ? `${formatDate(v.from, 'd MMM')} – ${formatDate(addDays(next.from, -1), 'd MMM')}`
                        : `Desde ${formatDate(v.from, "d 'de' MMM")}`}
                    </span>
                    <span className="tabular">{formatGoal(v)}</span>
                  </li>
                ))}
            </ol>
          </div>
        )}
      </div>
    </ResponsiveModal>
  )
}
