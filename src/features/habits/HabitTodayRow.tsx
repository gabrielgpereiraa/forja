import { ChevronRight } from 'lucide-react'

import { HabitGlyph, habitColorStyle } from '@/components/appearance'
import { HabitCheck } from '@/components/check-button'
import { SegmentedProgress } from '@/components/progress/progress-bar'
import { Badge } from '@/components/ui/badge'
import type { HabitDayState } from '@/domain/rules/habit-schedule'
import { cn } from '@/lib/utils'
import type { ScoreItemLabel } from '@/features/progress/score-items'
import { ScoreValueChip } from '@/features/progress/ScoreValueChip'
import { formatSessionProgress, paceBadge } from './habit-format'

/** Linha de hábito no painel do dia. Toque no círculo = concluir; toque na linha = detalhes/registro parcial. */
export function HabitTodayRow({
  state,
  onToggle,
  onOpen,
  locked,
  muted,
  hint,
  valueLabel,
}: {
  state: HabitDayState
  onToggle: () => void
  onOpen: () => void
  locked?: boolean
  muted?: boolean
  /** Rótulo contextual que substitui o selo de ritmo (ex.: "Confirmar amanhã"). */
  hint?: string
  /** Valor do hábito na nota de hoje (nota v2). */
  valueLabel?: ScoreItemLabel
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
            {/* Com o valor na nota (v2), a barrinha some em telas estreitas para caber o selo; o contador fica. */}
            <SegmentedProgress done={week.done} goal={week.goal} color="var(--hc)" className={cn('w-14 shrink-0', valueLabel && 'hidden sm:flex')} />
            <span className="shrink-0 tabular">
              {week.done}/{week.goal}
            </span>
            {valueLabel && <ScoreValueChip label={valueLabel} className="ml-auto" />}
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
