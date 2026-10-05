import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { TIER_COLOR, tierColor, tierInk } from '@/components/score'
import { Button } from '@/components/ui/button'
import { addDays, addMonths, capitalize, formatDate, monthGrid, startOfMonth, WEEKDAY_LETTER, WEEKDAYS_MONDAY_FIRST, type ISODate } from '@/domain/date'
import type { DailyRecord } from '@/domain/models/day'
import { SCORE_TIERS } from '@/domain/scoring/tiers'
import { cn, formatScore } from '@/lib/utils'

/** Calendário mensal: cada dia colorido pela faixa de nota — leitura de bons e maus dias em segundos. */
export function CalendarHeatmap({
  records,
  today,
  startDate,
  onSelect,
}: {
  records: Readonly<Record<string, DailyRecord | undefined>>
  today: ISODate
  startDate: ISODate | null
  onSelect: (d: ISODate) => void
}) {
  const [month, setMonth] = useState(() => startOfMonth(today))
  const weeks = monthGrid(month)
  const yesterday = addDays(today, -1)
  const isCurrent = month === startOfMonth(today)
  const canGoBack = !startDate || month > startOfMonth(startDate)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">{capitalize(formatDate(month, "MMMM 'de' yyyy"))}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Mês anterior" disabled={!canGoBack} onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Próximo mês" disabled={isCurrent} onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-[3px]">
        {WEEKDAYS_MONDAY_FIRST.map((d, i) => (
          <div key={i} className="pb-1 text-center text-[10px] font-medium text-muted-foreground">
            {WEEKDAY_LETTER[d]}
          </div>
        ))}
        {weeks.flat().map((date, i) => {
          if (!date) return <div key={`e${i}`} />
          const r = records[date]
          const future = date > today
          const isToday = date === today
          const has = Boolean(r && r.score !== null)
          return (
            <button
              key={date}
              type="button"
              disabled={future || (!r && !isToday && date !== yesterday)}
              onClick={() => onSelect(date)}
              aria-label={`${formatDate(date, "d 'de' MMMM")}: ${r ? `nota ${formatScore(r.score)}` : 'sem registro'}`}
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-[8px] text-[11px] font-medium tabular transition-transform outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:active:scale-90',
                !has && 'text-muted-foreground',
                !r && !future && 'bg-muted/40',
                r && r.score === null && 'ring-1 ring-inset ring-border',
                future && 'opacity-40',
                isToday && 'ring-2 ring-inset ring-foreground/70',
                !r && date === yesterday && 'ring-1 ring-inset ring-primary/60',
              )}
              style={has ? { background: tierColor(r!.score), color: tierInk(r!.score) } : undefined}
            >
              {Number(date.slice(8))}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
        {[...SCORE_TIERS].reverse().map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: TIER_COLOR[t.id] }} />
            {t.label}
            <span className="text-muted-foreground/60">{t.min > 0 ? `${formatScore(t.min)}+` : '<4'}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] ring-1 ring-inset ring-border" /> Sem plano
        </span>
      </div>
    </div>
  )
}
