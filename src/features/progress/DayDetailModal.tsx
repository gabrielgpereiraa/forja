import { Check, Circle, ListTodo, Repeat } from 'lucide-react'

import { HabitGlyph } from '@/components/appearance'
import { ResponsiveModal } from '@/components/responsive-modal'
import { ScorePill } from '@/components/score'
import { addDays, capitalize, formatDate, type ISODate } from '@/domain/date'
import { useDayOverview } from '@/hooks/use-domain'
import { useToday } from '@/hooks/use-today'
import { cn, formatNumber } from '@/lib/utils'
import { useUiStore } from '@/store/ui-store'
import { ScoreBreakdownView } from './ScoreBreakdownView'

export function DayDetailModal() {
  const date = useUiStore((s) => s.dayDetail)
  const close = useUiStore((s) => s.closeDayDetail)
  const today = useToday()
  return date ? <DayDetailContent date={date} today={today} onClose={close} /> : null
}

function DayDetailContent({ date, today, onClose }: { date: `${number}-${number}-${number}`; today: string; onClose: () => void }) {
  const o = useDayOverview(date)
  const score = o.breakdown.score
  const habits = [...o.plannedHabits, ...o.optionalHabits.filter((h) => h.doneToday)]
  const live = !o.record && (date === today || date === addDays(today as ISODate, -1))

  return (
    <ResponsiveModal
      open
      onOpenChange={(v) => !v && onClose()}
      title={capitalize(formatDate(date, "EEEE, d 'de' MMMM"))}
      description={o.record ? (o.record.closedBy === 'auto' ? 'Encerrado automaticamente' : 'Encerrado por você') : live ? (date === today ? 'Dia em andamento — nota prévia' : 'Aguardando a revisão da manhã — nota prévia') : 'Sem registro'}
    >
      <div className="space-y-5 pb-2">
        <div className="flex items-center justify-between rounded-2xl bg-surface p-4">
          <div>
            <div className="font-display text-[36px] leading-none font-semibold">
              {score === null ? '—' : formatNumber(score, 1)}
              <span className="ml-1 text-sm text-muted-foreground">/ 10</span>
            </div>
            <div className="mt-2">
              <ScorePill score={score} live={live} />
            </div>
          </div>
          <div className="text-right text-[13px] text-muted-foreground">
            {o.breakdown.highlights.map((h) => (
              <div key={h}>{h}</div>
            ))}
          </div>
        </div>

        <ScoreBreakdownView breakdown={o.breakdown} />

        {habits.length > 0 && (
          <section>
            <h4 className="mb-2 flex items-center gap-2 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Repeat className="size-3.5" /> Hábitos
            </h4>
            <ul className="space-y-1">
              {habits.map((h) => (
                <li key={h.habit.id} className="flex items-center gap-3 rounded-xl px-1 py-1">
                  <HabitGlyph icon={h.habit.icon} color={h.habit.color} size="sm" />
                  <span className={cn('flex-1 truncate text-sm', !h.doneToday && 'text-muted-foreground')}>{h.habit.name}</span>
                  {h.requirement !== 'required' && <span className="text-[11px] text-muted-foreground">extra</span>}
                  {h.doneToday ? <Check className="size-4 text-primary" strokeWidth={3} /> : <Circle className="size-4 text-muted-foreground/50" />}
                </li>
              ))}
            </ul>
          </section>
        )}

        {o.tasks.length > 0 && (
          <section>
            <h4 className="mb-2 flex items-center gap-2 text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
              <ListTodo className="size-3.5" /> Tarefas
            </h4>
            <ul className="space-y-1">
              {o.tasks.map((t) => (
                <li key={t.task.id} className="flex items-center gap-3 px-1 py-1 text-sm">
                  {t.doneOnDay ? <Check className="size-4 shrink-0 text-primary" strokeWidth={3} /> : <Circle className="size-4 shrink-0 text-muted-foreground/50" />}
                  <span className={cn('flex-1 truncate', !t.doneOnDay && 'text-muted-foreground')}>{t.task.title}</span>
                  {t.role === 'overdue' && !t.doneOnDay && <span className="text-[11px] text-danger">atrasada</span>}
                  {t.role === 'bonus' && <span className="text-[11px] text-muted-foreground">adiantada</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </ResponsiveModal>
  )
}
