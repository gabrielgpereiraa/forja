import { CalendarCheck, RotateCcw } from 'lucide-react'

import { Surface } from '@/components/layout'
import { ScorePill } from '@/components/score'
import { Button } from '@/components/ui/button'
import type { DailyRecord } from '@/domain/models/day'
import { ScoreBreakdownView } from '@/features/progress/ScoreBreakdownView'
import { formatNumber } from '@/lib/utils'

export function ClosedDayCard({ record, onReopen, onPlanTomorrow }: { record: DailyRecord; onReopen: () => void; onPlanTomorrow: () => void }) {
  return (
    <Surface className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2 text-[12px] font-medium tracking-wide text-muted-foreground uppercase">
            <CalendarCheck className="size-4 text-primary" /> Dia concluído
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-display text-[44px] leading-none font-semibold tabular">
              {record.score === null ? '—' : formatNumber(record.score, 1)}
            </span>
            <span className="text-sm text-muted-foreground">/ 10</span>
          </div>
          <div className="mt-2">
            <ScorePill score={record.score} />
          </div>
        </div>
        <div className="text-right text-[13px] text-muted-foreground">
          {record.breakdown.highlights.map((h) => (
            <div key={h}>{h}</div>
          ))}
        </div>
      </div>
      <div className="border-t bg-surface/50 p-4 sm:p-5">
        <ScoreBreakdownView breakdown={record.breakdown} />
      </div>
      <div className="flex gap-2 border-t p-3">
        <Button variant="secondary" className="flex-1" onClick={onPlanTomorrow}>
          Planejar amanhã
        </Button>
        <Button variant="ghost" onClick={onReopen}>
          <RotateCcw /> Reabrir
        </Button>
      </div>
    </Surface>
  )
}
