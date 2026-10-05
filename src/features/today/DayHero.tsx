import { Flame, Sparkles } from 'lucide-react'
import { Link } from 'react-router'

import { AnimatedNumber } from '@/components/animated-number'
import { Surface } from '@/components/layout'
import { ProgressRing } from '@/components/progress/progress-ring'
import { ScorePill } from '@/components/score'
import type { DayOverview } from '@/domain/rules/day-overview'
import type { StreakInfo } from '@/domain/rules/streaks'
import type { LevelInfo } from '@/domain/models/gamification'
import { ProgressBar } from '@/components/progress/progress-bar'
import { formatNumber } from '@/lib/utils'

const phaseMessage: Record<DayOverview['phase'], string> = {
  empty: 'Dia em branco. Adicione um hábito ou uma tarefa para começar.',
  not_started: 'Tudo pronto. Comece pelo que é mais rápido.',
  in_progress: 'Em andamento. Continue no ritmo.',
  all_done: 'Tudo feito. Encerre o dia para registrar sua nota.',
  closed: 'Dia encerrado.',
}

export function DayHero({
  overview,
  streak,
  level,
  xpToday,
}: {
  overview: DayOverview
  streak: StreakInfo
  level: LevelInfo
  xpToday: number
}) {
  const score = overview.breakdown.score
  const pct = Math.round(overview.progress * 100)

  return (
    <Surface className="relative overflow-hidden p-4 sm:p-5">
      <div className="flex items-center gap-4 sm:gap-6">
        <ProgressRing value={overview.progress} size={116} stroke={11}>
          <span className="font-display text-[30px] leading-none font-semibold tabular">
            <AnimatedNumber value={pct} />
            <span className="text-base text-muted-foreground">%</span>
          </span>
          <span className="mt-1 text-[11px] text-muted-foreground tabular">
            {overview.totalItems === 0 ? 'nada previsto' : `${overview.doneItems} de ${overview.totalItems}`}
          </span>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">{overview.phase === 'all_done' ? 'Nota do dia' : 'Nota até agora'}</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-display text-[40px] leading-none font-semibold tabular">
              {score === null ? '—' : <AnimatedNumber value={score} format={(n) => formatNumber(n, 1)} />}
            </span>
            <span className="text-sm text-muted-foreground">/ 10</span>
          </div>
          <div className="mt-2">
            <ScorePill score={score} live />
          </div>
          <p className="mt-2 hidden text-[13px] leading-snug text-muted-foreground sm:block">{phaseMessage[overview.phase]}</p>
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-snug text-muted-foreground sm:hidden">{phaseMessage[overview.phase]}</p>

      <div className="mt-4 grid grid-cols-[auto_auto_1fr] items-center gap-x-4 border-t pt-3.5 text-[13px]">
        <span className="inline-flex items-center gap-1.5 font-medium" title="Sequência de dias positivos">
          <Flame className={streak.current > 0 ? 'size-4 text-xp' : 'size-4 text-muted-foreground'} />
          <span className="tabular">{streak.current}</span>
          <span className="text-muted-foreground">{streak.current === 1 ? 'dia' : 'dias'}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Sparkles className="size-4 text-xp" />
          <span className="tabular text-xp">+{xpToday}</span>
          <span className="text-muted-foreground">XP hoje</span>
        </span>
        <Link to="/perfil" className="group flex min-w-0 items-center gap-2 justify-self-end" aria-label="Ver perfil e nível">
          <span className="shrink-0 text-[12px] font-semibold text-muted-foreground group-hover:text-foreground">Nv {level.level}</span>
          <ProgressBar value={level.progress} size="xs" className="w-16 sm:w-24" barClassName="bg-xp" />
        </Link>
      </div>
    </Surface>
  )
}
