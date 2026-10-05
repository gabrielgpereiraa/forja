import { tierColor } from '@/components/score'
import { WEEKDAY_SHORT, weekdayOf, type ISODate } from '@/domain/date'
import type { WeekDayColumn } from '@/domain/rules/week-overview'
import { cn, formatScore } from '@/lib/utils'

/**
 * Barras de nota diária (0–10) da semana. Um eixo, marcas finas com topo
 * arredondado, rótulo apenas no dia selecionado. Toque seleciona o dia.
 */
export function WeekScoreBars({
  days,
  today,
  selected,
  onSelect,
}: {
  days: WeekDayColumn[]
  today: ISODate
  selected: ISODate | null
  onSelect: (d: ISODate) => void
}) {
  const H = 132
  return (
    <div>
      <div className="relative" style={{ height: H }}>
        {/* Grade recessiva: 0, 5, 10 */}
        {[0, 5, 10].map((v) => (
          <div key={v} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: (v / 10) * (H - 18) }}>
            <span className="w-4 text-right text-[10px] text-muted-foreground/70 tabular">{v}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        ))}
        <div className="absolute inset-y-0 right-0 left-6 flex items-end gap-[2px]">
          {days.map((d) => {
            const h = d.score === null ? 0 : (d.score / 10) * (H - 18)
            const active = selected === d.date
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => !d.isFuture && onSelect(d.date)}
                disabled={d.isFuture}
                aria-label={`${WEEKDAY_SHORT[weekdayOf(d.date)]}: nota ${formatScore(d.score)}`}
                aria-pressed={active}
                className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none disabled:cursor-default"
              >
                {active && d.score !== null && (
                  <span className="absolute text-[11px] font-semibold text-foreground tabular" style={{ bottom: h + 4 }}>
                    {formatScore(d.score)}
                  </span>
                )}
                <span
                  className={cn(
                    'w-full max-w-9 rounded-t-[4px] transition-[height,opacity] duration-500',
                    d.live && 'opacity-60',
                    selected && !active && 'opacity-55',
                    'group-focus-visible:ring-2 group-focus-visible:ring-ring',
                  )}
                  style={{ height: Math.max(h, d.score === null ? 0 : 3), background: tierColor(d.score) }}
                />
                {d.score === null && !d.isFuture && <span className="mb-0 h-[3px] w-full max-w-9 rounded-full bg-muted" />}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-[2px] pl-6">
        {days.map((d) => (
          <span
            key={d.date}
            className={cn(
              'flex-1 text-center text-[11px] font-medium text-muted-foreground',
              d.date === today && 'text-foreground',
              selected === d.date && 'font-semibold text-foreground',
            )}
          >
            {WEEKDAY_SHORT[weekdayOf(d.date)]}
          </span>
        ))}
      </div>
    </div>
  )
}
