import { formatDate } from '@/domain/date'
import type { WeekConsistency } from '@/domain/rules/history'
import { cn } from '@/lib/utils'

/** % das metas semanais cumpridas nas últimas semanas — uma série, uma cor. */
export function ConsistencyBars({ weeks }: { weeks: WeekConsistency[] }) {
  const H = 96
  const last = weeks.length - 1
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height: H }}>
        {weeks.map((w, i) => {
          const pct = w.ratio === null ? 0 : Math.round(w.ratio * 100)
          return (
            <div key={w.weekStart} className="group relative flex h-full flex-1 flex-col items-center justify-end" title={`${formatDate(w.weekStart, 'd MMM')}: ${pct}% (${w.done}/${w.goal})`}>
              {(i === last || pct === 100) && w.ratio !== null && (
                <span className="mb-1 text-[10px] font-semibold text-foreground tabular">{pct}%</span>
              )}
              <div
                className={cn('w-full max-w-10 rounded-t-[4px] bg-primary transition-[height] duration-500', i !== last && 'opacity-70')}
                style={{ height: `${Math.max(w.ratio === null ? 0 : 3, (pct / 100) * (H - 16))}px` }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 h-px bg-border" />
      <div className="mt-1.5 flex gap-[2px]">
        {weeks.map((w, i) => (
          <span key={w.weekStart} className={cn('flex-1 text-center text-[10px] text-muted-foreground', i === last && 'font-semibold text-foreground')}>
            {i === last ? 'Atual' : formatDate(w.weekStart, 'd/M')}
          </span>
        ))}
      </div>
    </div>
  )
}
