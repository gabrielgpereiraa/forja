import { useMemo, useState } from 'react'
import { CalendarCheck, Flame, Star, Table2, Trophy } from 'lucide-react'

import { StatTile, Surface } from '@/components/layout'
import { ScorePill } from '@/components/score'
import { addDays, formatDate, type ISODate } from '@/domain/date'
import { buildScoreSeries, buildWeeklyConsistency } from '@/domain/rules/history'
import { averageScore } from '@/domain/rules/stats'
import { STREAK_MIN_SCORE } from '@/domain/rules/streaks'
import { useLogIndex, useStreak } from '@/hooks/use-domain'
import { cn, formatScore } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { CalendarHeatmap } from './CalendarHeatmap'
import { ConsistencyBars } from './ConsistencyBars'
import { ScoreLineChart } from './ScoreLineChart'

export function HistoryView({ today }: { today: ISODate }) {
  const records = useAppStore((s) => s.records)
  const habits = useAppStore((s) => s.habits)
  const startDate = useAppStore((s) => s.profile.startDate)
  const logs = useLogIndex()
  const streak = useStreak(today)
  const openDayDetail = useUiStore((s) => s.openDayDetail)
  const [table, setTable] = useState(false)

  const from30 = addDays(today, -29)
  const seriesFrom = startDate && startDate > from30 ? startDate : from30
  const series = useMemo(() => buildScoreSeries(records, seriesFrom, addDays(today, -1) < seriesFrom ? seriesFrom : addDays(today, -1)), [records, seriesFrom, today])
  const weeks = useMemo(() => buildWeeklyConsistency(habits, logs, today, 8), [habits, logs, today])
  const avg30 = averageScore(records, from30, today)
  const avgPrev = averageScore(records, addDays(from30, -30), addDays(from30, -1))
  const scored = series.filter((p) => p.score !== null)
  const positive = scored.filter((p) => (p.score ?? 0) >= STREAK_MIN_SCORE).length
  const hasHistory = Object.keys(records).length > 0

  const trend = avg30 !== null && avgPrev !== null ? Math.round((avg30 - avgPrev) * 10) / 10 : null

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          icon={Star}
          accent="var(--xp)"
          label="Média 30 dias"
          value={formatScore(avg30)}
          sub={trend === null ? 'nota diária' : `${trend >= 0 ? '+' : ''}${formatScore(trend)} vs. mês anterior`}
        />
        <StatTile icon={Flame} accent="var(--xp)" label="Sequência" value={streak.current} sub={streak.status === 'pending' ? 'feche hoje para somar' : 'dias positivos'} />
        <StatTile icon={Trophy} label="Melhor sequência" value={streak.best} sub="dias" />
        <StatTile icon={CalendarCheck} label="Dias positivos" value={scored.length ? `${Math.round((positive / scored.length) * 100)}%` : '—'} sub={`nota ${STREAK_MIN_SCORE}+ · 30 dias`} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
      <Surface className="p-4">
        <CalendarHeatmap records={records} today={today} startDate={startDate} onSelect={openDayDetail} />
      </Surface>

      <Surface className="p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-muted-foreground">Evolução da nota</h3>
          <button
            type="button"
            onClick={() => setTable((v) => !v)}
            className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-muted-foreground hover:bg-accent', table && 'bg-accent text-foreground')}
            aria-pressed={table}
          >
            <Table2 className="size-3.5" /> Tabela
          </button>
        </div>
        {!hasHistory || scored.length < 2 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Encerre alguns dias para ver sua evolução aqui.</p>
        ) : table ? (
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-card text-left text-[11px] text-muted-foreground uppercase">
                <tr>
                  <th className="py-2 font-medium">Dia</th>
                  <th className="py-2 font-medium">Nota</th>
                  <th className="py-2 text-right font-medium">Média 7d</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...series].reverse().map((p) => (
                  <tr key={p.date} className="cursor-pointer hover:bg-accent/40" onClick={() => openDayDetail(p.date)}>
                    <td className="py-1.5">{formatDate(p.date, "EEE, d 'de' MMM")}</td>
                    <td className="py-1.5">
                      <ScorePill score={p.score} />
                    </td>
                    <td className="py-1.5 text-right tabular">{formatScore(p.avg7)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-2">
            <ScoreLineChart points={series} />
          </div>
        )}
      </Surface>

      </div>

      <Surface className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-muted-foreground">Consistência semanal</h3>
          <span className="text-[12px] text-muted-foreground">% das metas de hábitos</span>
        </div>
        <ConsistencyBars weeks={weeks} />
      </Surface>
    </div>
  )
}
