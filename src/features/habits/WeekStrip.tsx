import { Check } from 'lucide-react'

import { WEEKDAY_LETTER, weekdayOf, type ISODate } from '@/domain/date'
import type { HabitDayMark } from '@/domain/rules/week-overview'
import { cn } from '@/lib/utils'

/** 7 marcadores (seg→dom) mostrando o que foi feito na semana. Requer escopo `.habit-color`. */
export function WeekStrip({
  marks,
  today,
  size = 'md',
  showLetters = true,
}: {
  marks: { date: ISODate; mark: HabitDayMark }[]
  today: ISODate
  size?: 'sm' | 'md'
  showLetters?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      {marks.map(({ date, mark }) => (
        <div key={date} className="flex flex-1 flex-col items-center gap-1">
          <div
            title={date}
            className={cn(
              'flex items-center justify-center rounded-full transition-colors',
              size === 'md' ? 'size-7' : 'size-5',
              mark === 'done' && 'bg-[var(--hc)] text-[var(--hc-fg)]',
              mark === 'partial' && 'bg-[color-mix(in_oklch,var(--hc)_30%,transparent)]',
              mark === 'missed' && 'bg-danger/12 ring-1 ring-inset ring-danger/30',
              mark === 'planned' && 'ring-1 ring-inset ring-muted-foreground/30',
              mark === 'rest' && 'bg-muted',
              mark === 'inactive' && 'opacity-30 bg-muted',
              date === today && mark !== 'done' && 'ring-2 ring-inset ring-[color-mix(in_oklch,var(--hc)_70%,transparent)]',
            )}
          >
            {mark === 'done' && <Check className={size === 'md' ? 'size-3.5' : 'size-3'} strokeWidth={3.5} />}
          </div>
          {showLetters && (
            <span className={cn('text-[10px] font-medium text-muted-foreground', date === today && 'text-foreground')}>
              {WEEKDAY_LETTER[weekdayOf(date)]}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
