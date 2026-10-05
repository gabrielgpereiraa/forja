import { ChevronRight } from 'lucide-react'

import { HabitGlyph, habitColorStyle } from '@/components/appearance'
import { HabitCheck } from '@/components/check-button'
import { SegmentedProgress } from '@/components/progress/progress-bar'
import { Badge } from '@/components/ui/badge'
import type { HabitDayState } from '@/domain/rules/habit-schedule'
import { cn } from '@/lib/utils'
import { formatSessionProgress, paceBadge } from './habit-format'

/** Linha de hábito no painel do dia. Toque no círculo = concluir; toque na linha = detalhes/registro parcial. */
export function HabitTodayRow({
  state,
  onToggle,
  onOpen,
  locked,
  muted,
  hint,
}: {
  state: HabitDayState
  onToggle: () => void
  onOpen: () => void
  locked?: boolean
  muted?: boolean
  /** Rótulo contextual que substitui o selo de ritmo (ex.: "Confirmar amanhã"). */
  hint?: string
}) {
  const { habit, week } = state
  const session = formatSessionProgress(state)
  const badge = hint ? { label: hint, tone: 'secondary' as const } : paceBadge(state)

  return (
    <div
      style={habitColorStyle(habit.color)}
      className={cn(
        'habit-color group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors',
        'hover:bg-accent/50',
        state.doneToday && 'bg-[color-mix(in_oklch,var(--hc)_6%,transparent)]',
        muted && !state.doneToday && 'opacity-75',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-xl"
        aria-label={`Detalhes de ${habit.name}`}
      >
        <HabitGlyph icon={habit.icon} color={habit.color} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('min-w-0 truncate text-[15px] font-medium', state.doneToday && 'text-muted-foreground')}>{habit.name}</span>
            {badge && (
              <Badge variant={badge.tone} className="hidden min-[380px]:inline-flex">
                {badge.label}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
            {session && <span className="shrink-0 tabular">{session}</span>}
            {session && <span className="text-muted-foreground/40">·</span>}
            <SegmentedProgress done={week.done} goal={week.goal} color="var(--hc)" className="w-14 shrink-0" />
            <span className="shrink-0 tabular">
              {week.done}/{week.goal}
            </span>
          </div>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/50" />
      </button>
      <HabitCheck
        done={state.doneToday}
        progress={state.sessionProgress}
        onToggle={onToggle}
        disabled={locked}
        label={state.doneToday ? `Desmarcar ${habit.name}` : `Concluir ${habit.name}`}
      />
    </div>
  )
}
