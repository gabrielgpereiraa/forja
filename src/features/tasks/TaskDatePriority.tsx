import { CalendarDays, Flag } from 'lucide-react'

import { ChipGroup } from '@/components/chip-group'
import { addDays, formatDate, isISODate, type ISODate } from '@/domain/date'
import { TASK_PRIORITY_META, type TaskPriority } from '@/domain/models/task'
import { cn } from '@/lib/utils'

type DateChoice = 'today' | 'tomorrow' | 'none' | 'custom'

export function choiceOf(date: ISODate | null, today: ISODate): DateChoice {
  if (date === null) return 'none'
  if (date === today) return 'today'
  if (date === addDays(today, 1)) return 'tomorrow'
  return 'custom'
}

/** Seletor de data com atalhos — evita abrir calendário no caso comum. */
export function TaskDatePicker({
  value,
  onChange,
  today,
  size = 'md',
}: {
  value: ISODate | null
  onChange: (d: ISODate | null) => void
  today: ISODate
  size?: 'sm' | 'md'
}) {
  const choice = choiceOf(value, today)
  return (
    <div className="flex flex-wrap gap-1.5">
      <ChipGroup<DateChoice>
        size={size}
        ariaLabel="Data"
        value={choice === 'custom' ? null : choice}
        onChange={(c) => onChange(c === 'today' ? today : c === 'tomorrow' ? addDays(today, 1) : null)}
        options={[
          { value: 'today', label: 'Hoje' },
          { value: 'tomorrow', label: 'Amanhã' },
          { value: 'none', label: 'Sem data' },
        ]}
      />
      <label
        className={cn(
          'relative inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border font-medium whitespace-nowrap transition-colors focus-within:ring-[3px] focus-within:ring-ring/50 [&_svg]:size-4',
          size === 'md' ? 'h-10 px-3.5 text-sm' : 'h-8 px-2.5 text-[13px]',
          choice === 'custom' ? 'border-primary/60 bg-primary/12 text-foreground' : 'border-border bg-surface text-muted-foreground hover:text-foreground',
        )}
      >
        <CalendarDays />
        {choice === 'custom' && value ? formatDate(value, "d 'de' MMM") : 'Data…'}
        <input
          type="date"
          className="absolute inset-0 opacity-0"
          value={value ?? ''}
          min={today}
          onChange={(e) => {
            const v = e.target.value
            onChange(v && isISODate(v) ? v : null)
          }}
          aria-label="Escolher data"
        />
      </label>
    </div>
  )
}

export function TaskPriorityPicker({
  value,
  onChange,
  size = 'md',
}: {
  value: TaskPriority
  onChange: (p: TaskPriority) => void
  size?: 'sm' | 'md'
}) {
  return (
    <ChipGroup<TaskPriority>
      size={size}
      ariaLabel="Prioridade"
      value={value}
      onChange={onChange}
      options={(['low', 'normal', 'high'] as const).map((p) => ({
        value: p,
        label: TASK_PRIORITY_META[p].label,
        icon: p === 'high' ? <Flag className="text-warning" /> : undefined,
      }))}
    />
  )
}
