import { useState } from 'react'
import { CalendarCheck, ChevronDown, Flame, ListTodo, Plus, Repeat, X } from 'lucide-react'

import { BrandMark } from '@/components/brand'
import { ProfileButton } from '@/components/profile-button'
import { SkillRustBanner } from '@/features/skills/SkillRustBanner'
import { EmptyState, SectionHeader, Surface } from '@/components/layout'
import { HabitGlyph } from '@/components/appearance'
import { Button } from '@/components/ui/button'
import { addDays, capitalize, formatDate } from '@/domain/date'
import { eligibleLateHabitIds } from '@/domain/rules/late-confirmation'
import type { HabitDayState } from '@/domain/rules/habit-schedule'
import { useDayOverview, useLateConfirmation, usePendingReview, usePlayer, useStreak } from '@/hooks/use-domain'
import { useToday } from '@/hooks/use-today'
import { cn, formatNumber } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { useHabitActions, useTaskActions } from '@/features/feedback/use-actions'
import { HABIT_TEMPLATES } from '@/features/habits/habit-templates'
import { HabitTodayRow } from '@/features/habits/HabitTodayRow'
import { TaskComposer } from '@/features/tasks/TaskComposer'
import { TaskRow } from '@/features/tasks/TaskRow'
import { lateLabel } from '@/features/tasks/task-format'
import { ClosedDayCard } from './ClosedDayCard'
import { CompleteDayModal } from './CompleteDayModal'
import { DayHero } from './DayHero'
import { LateConfirmationCard } from './LateConfirmationCard'
import { YesterdayReview } from './YesterdayReview'

function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h >= 5 && h < 12) return 'Bom dia'
  if (h >= 12 && h < 18) return 'Boa tarde'
  return 'Boa noite'
}

const DISMISS_KEY = 'forja.ui.streakBannerDismissed'
const LATE_DISMISS_KEY = 'forja.ui.lateConfirmDismissed'

function readDismissed(key = DISMISS_KEY): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeDismissed(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* armazenamento indisponível */
  }
}

export function TodayPage() {
  const today = useToday()
  const name = useAppStore((s) => s.profile.name)
  const habitCount = useAppStore((s) => s.habits.filter((h) => !h.archived).length)
  const reopenDay = useAppStore((s) => s.reopenDay)
  const overview = useDayOverview(today)
  const yesterdayOverview = useDayOverview(addDays(today, -1))
  const pendingReview = usePendingReview(today)
  const [yesterdayOpen, setYesterdayOpen] = useState(false)
  const streak = useStreak(today)
  const player = usePlayer(today)
  const { openHabitForm, openTaskForm, openHabitLog } = useUiStore()
  const habitActions = useHabitActions()
  const taskActions = useTaskActions()

  const [completeOpen, setCompleteOpen] = useState(false)
  const [showOptional, setShowOptional] = useState(false)
  const [dismissed, setDismissed] = useState(readDismissed)
  const late = useLateConfirmation(today)
  const [lateDismissed, setLateDismissed] = useState(() => readDismissed(LATE_DISMISS_KEY))
  // O cartão aparece enquanto há algo a confirmar; depois de aberto, fica até o
  // fim da visita (para mostrar "Confirmado" e permitir desfazer).
  const [lateSeen, setLateSeen] = useState<string | null>(null)
  const latePending = late?.pending.size ?? 0
  if (late && latePending > 0 && lateSeen !== late.date) setLateSeen(late.date)
  const showLate = Boolean(late && lateDismissed !== late.date && (latePending > 0 || lateSeen === late.date))

  const closed = overview.phase === 'closed'
  const allHabits = useAppStore((s) => s.habits)
  // Encerrado: só os que ficaram na lista do encerramento podem ser confirmados amanhã.
  const lateEligible = overview.record ? new Set(eligibleLateHabitIds(overview.record, allHabits)) : null
  const awaitsConfirmation = (st: HabitDayState) =>
    !st.doneToday && (lateEligible ? lateEligible.has(st.habit.id) : Boolean(st.habit.confirmNextDay))
  const score = overview.breakdown.score
  const showBrokenBanner = streak.status === 'broken' && dismissed !== today
  const optionalDone = overview.optionalHabits.filter((h) => h.doneToday).length

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="flex items-end justify-between gap-4 pt-2 pb-5">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground">
            <BrandMark className="size-5 md:hidden" />
            {capitalize(formatDate(today, "EEEE, d 'de' MMMM"))}
          </div>
          <h1 className="truncate font-display text-[28px] leading-[1.1] font-semibold md:text-[32px]">
            {greeting()}
            {name ? `, ${name}` : ''}
          </h1>
        </div>
        <ProfileButton className="md:hidden" />
      </header>

      {pendingReview && <YesterdayReview overview={pendingReview} onComplete={() => setYesterdayOpen(true)} />}

      {!pendingReview && late && showLate && (
        <LateConfirmationCard
          key={late.date}
          date={late.date}
          today={today}
          record={late.record}
          states={late.states}
          confirmed={late.confirmed}
          onDismiss={() => {
            setLateDismissed(late.date)
            writeDismissed(LATE_DISMISS_KEY, late.date)
          }}
        />
      )}

      {!showBrokenBanner && <SkillRustBanner today={today} />}

      {showBrokenBanner && !pendingReview && !showLate && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-xp/20 bg-xp/8 p-3.5 animate-rise">
          <Flame className="mt-0.5 size-4 shrink-0 text-xp" />
          <div className="min-w-0 flex-1 text-[13px]">
            <div className="font-medium">Sua sequência de {streak.lostLength} dias terminou ontem.</div>
            <div className="text-muted-foreground">Sem problema — consistência é voltar. Feche hoje com nota 6+ para recomeçar.</div>
          </div>
          <button
            type="button"
            className="-m-1 rounded-lg p-1 text-muted-foreground hover:bg-accent"
            aria-label="Dispensar aviso"
            onClick={() => {
              setDismissed(today)
              writeDismissed(DISMISS_KEY, today)
            }}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-6">
          {closed && overview.record ? (
            <ClosedDayCard
              record={overview.record}
              onReopen={() => reopenDay(today)}
              onPlanTomorrow={() => openTaskForm(null, { dueDate: addDays(today, 1) })}
            />
          ) : (
            <DayHero overview={overview} streak={streak} level={player.level} xpToday={player.xpToday} />
          )}

          {/* ------------------------------ Hábitos ------------------------------ */}
          <section aria-labelledby="habits-today">
            <SectionHeader
              icon={Repeat}
              title={<span id="habits-today">Hábitos de hoje</span>}
              meta={overview.plannedHabits.length > 0 ? `${overview.habitsDone}/${overview.plannedHabits.length}` : undefined}
              action={
                habitCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => openHabitForm()} className="text-muted-foreground">
                    <Plus /> Novo
                  </Button>
                )
              }
            />
            {habitCount === 0 ? (
              <EmptyState
                icon={Repeat}
                title="Crie seu primeiro hábito"
                description="Hábitos são compromissos recorrentes, medidos por semana. Comece com um destes:"
              >
                {HABIT_TEMPLATES.slice(0, 4).map((t) => (
                  <Button key={t.name} variant="outline" size="sm" onClick={() => openHabitForm(null, t)}>
                    <HabitGlyph icon={t.icon} color={t.color} size="sm" className="-ml-1.5 size-6 rounded-md [&_svg]:size-3.5" />
                    {t.name}
                  </Button>
                ))}
                <Button size="sm" onClick={() => openHabitForm()}>
                  <Plus /> Personalizado
                </Button>
              </EmptyState>
            ) : (
              <Surface className="p-1.5">
                {overview.plannedHabits.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">
                    Nenhum hábito obrigatório hoje — você está em dia com o ritmo da semana. Fazer algum abaixo é bônus.
                  </div>
                ) : (
                  overview.plannedHabits.map((s) => (
                    <HabitTodayRow
                      key={s.habit.id}
                      state={s}
                      hint={awaitsConfirmation(s) ? 'Confirmar amanhã' : undefined}
                      locked={closed}
                      onToggle={() => habitActions.toggle(s.habit.id, today)}
                      onOpen={() => openHabitLog(s.habit.id, today)}
                    />
                  ))
                )}

                {overview.optionalHabits.length > 0 && (
                  <div className="mt-1 border-t pt-1">
                    <button
                      type="button"
                      onClick={() => setShowOptional((v) => !v)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] text-muted-foreground hover:bg-accent/50"
                      aria-expanded={showOptional}
                    >
                      <span>
                        Opcionais hoje · {overview.optionalHabits.length}
                        {optionalDone > 0 && <span className="text-primary"> · {optionalDone} feito{optionalDone > 1 ? 's' : ''}</span>}
                      </span>
                      <ChevronDown className={cn('size-4 transition-transform', showOptional && 'rotate-180')} />
                    </button>
                    {showOptional &&
                      overview.optionalHabits.map((s) => (
                        <HabitTodayRow
                          key={s.habit.id}
                          state={s}
                          hint={awaitsConfirmation(s) ? 'Confirmar amanhã' : undefined}
                          muted
                          locked={closed}
                          onToggle={() => habitActions.toggle(s.habit.id, today)}
                          onOpen={() => openHabitLog(s.habit.id, today)}
                        />
                      ))}
                  </div>
                )}
              </Surface>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* ------------------------------ Tarefas ------------------------------ */}
          <section aria-labelledby="tasks-today">
            <SectionHeader
              icon={ListTodo}
              title={<span id="tasks-today">Tarefas</span>}
              meta={overview.tasksTotal > 0 ? `${overview.tasksDone}/${overview.tasksTotal}` : undefined}
              hint={overview.overdueCount > 0 ? `${overview.overdueCount} atrasada${overview.overdueCount > 1 ? 's' : ''}` : undefined}
            />
            {!closed && <TaskComposer today={today} defaultDate={today} className="mb-2" />}
            {overview.tasks.length === 0 ? (
              <div className="rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
                {closed ? 'Nenhuma tarefa neste dia.' : 'Nada pendente para hoje. Tarefas são ações pontuais — adicione acima.'}
              </div>
            ) : (
              <Surface className="p-1.5">
                {overview.tasks.map((item) => (
                  <TaskRow
                    key={item.task.id}
                    task={item.task}
                    today={today}
                    showDate={false}
                    lateText={item.doneOnDay ? null : lateLabel(item)}
                    locked={closed}
                    onToggle={() => taskActions.toggle(item.task.id, today)}
                    onOpen={() => openTaskForm(item.task.id)}
                  />
                ))}
              </Surface>
            )}
          </section>

          {!closed && (
            <Surface className="hidden items-center justify-between gap-4 p-4 lg:flex">
              <div>
                <div className="font-medium">Encerrar o dia</div>
                <div className="text-[13px] text-muted-foreground">Registra a nota no histórico e calcula sua sequência.</div>
              </div>
              <Button onClick={() => setCompleteOpen(true)} disabled={score === null}>
                <CalendarCheck /> Completar dia
              </Button>
            </Surface>
          )}
        </div>
      </div>

      {/* Barra de ação fixa (mobile) */}
      {!closed && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-4 pb-3 md:bottom-0 md:pl-[calc(16rem+1rem)] lg:hidden">
          <div className="pointer-events-auto mx-auto flex max-w-lg gap-2 rounded-[20px] border bg-popover/90 p-1.5 shadow-xl shadow-black/20 backdrop-blur-xl">
            <Button
              variant="secondary"
              size="icon"
              className="size-12 rounded-2xl"
              aria-label="Adicionar"
              onClick={() => useUiStore.getState().setQuickAdd(true)}
            >
              <Plus className="size-5" />
            </Button>
            <Button
              className={cn('h-12 flex-1 rounded-2xl text-[15px]', overview.phase === 'all_done' && 'shadow-[0_0_24px_color-mix(in_oklch,var(--primary)_45%,transparent)]')}
              onClick={() => setCompleteOpen(true)}
              disabled={score === null}
            >
              <CalendarCheck className="size-5" />
              Completar dia
              {score !== null && <span className="ml-1 rounded-md bg-primary-foreground/12 px-1.5 py-0.5 text-[13px] tabular">{formatNumber(score, 1)}</span>}
            </Button>
          </div>
        </div>
      )}

      <CompleteDayModal open={completeOpen} onOpenChange={setCompleteOpen} overview={overview} />
      <CompleteDayModal open={yesterdayOpen} onOpenChange={setYesterdayOpen} overview={yesterdayOverview} mode="yesterday" />
    </div>
  )
}
