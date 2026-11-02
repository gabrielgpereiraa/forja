import { Activity } from 'lucide-react'

import { Surface } from '@/components/layout'
import { ProgressBar } from '@/components/progress/progress-bar'
import type { WeeklyRhythm } from '@/domain/rules/weekly-rhythm'
import { formatNumber } from '@/lib/utils'

/**
 * Ritmo da semana (nota v2): indicador próprio, fora da nota do dia. Soma o
 * parcial de hoje uma vez; sessões concluídas não contam em dobro.
 */
export function WeeklyRhythmCard({ rhythm }: { rhythm: WeeklyRhythm }) {
  if (rhythm.ratio === null) return null
  return (
    <Surface className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            <Activity className="size-4 text-primary" /> Ritmo da semana
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">Indicador das metas semanais. Não entra na nota do dia.</div>
        </div>
        <span className="font-display text-[26px] leading-none font-semibold tabular">
          {Math.round(rhythm.ratio * 100)}
          <span className="text-sm text-muted-foreground">%</span>
        </span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {rhythm.habits.map((h) => (
          <li key={h.habitId}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
              <span className="min-w-0 truncate">{h.name}</span>
              <span className="shrink-0 text-muted-foreground tabular">
                {h.done}
                {h.partialToday > 0 && ` + ${formatNumber(h.partialToday, 1)} hoje`} de {h.expected} {h.expected === 1 ? 'esperada' : 'esperadas'}
              </span>
            </div>
            <ProgressBar value={h.ratio} size="xs" />
          </li>
        ))}
      </ul>
    </Surface>
  )
}
