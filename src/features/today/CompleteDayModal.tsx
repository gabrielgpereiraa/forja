import { useState } from 'react'
import { motion } from 'motion/react'
import { Award, CircleAlert, Flame, Moon, Sparkles } from 'lucide-react'

import { AnimatedNumber } from '@/components/animated-number'
import { ResponsiveModal } from '@/components/responsive-modal'
import { tierColor } from '@/components/score'
import { Button } from '@/components/ui/button'
import { getScoreTier } from '@/domain/scoring/tiers'
import type { DayOverview } from '@/domain/rules/day-overview'
import { STREAK_MIN_SCORE } from '@/domain/rules/streaks'
import { notifyProgression } from '@/features/feedback/notify'
import { ScoreBreakdownView } from '@/features/progress/ScoreBreakdownView'
import { formatNumber, pluralize } from '@/lib/utils'
import type { Feedback } from '@/services/commands'
import { useAppStore } from '@/store/app-store'

/**
 * Fluxo "Completar dia": revisar a nota → confirmar → celebração/resultado.
 * `mode="yesterday"` é o encerramento feito na revisão da manhã seguinte.
 */
export function CompleteDayModal({
  open,
  onOpenChange,
  overview,
  mode = 'today',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  overview: DayOverview
  mode?: 'today' | 'yesterday'
}) {
  const closeDay = useAppStore((s) => s.closeDay)
  const [result, setResult] = useState<Feedback | null>(null)
  const isYesterday = mode === 'yesterday'

  // Hábitos que só se confirmam depois (ex.: dormir cedo) e ainda estão abertos.
  const awaitingConfirmation = isYesterday
    ? []
    : [...overview.plannedHabits, ...overview.optionalHabits].filter((h) => h.habit.confirmNextDay && !h.doneToday)
  const pendingHabits = overview.plannedHabits.filter((h) => !h.doneToday).length
  const pendingTasks = overview.tasks.filter((t) => t.role !== 'bonus' && !t.doneOnDay).length
  const score = result?.record?.score ?? overview.breakdown.score

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) window.setTimeout(() => setResult(null), 250)
  }

  const confirm = () => {
    const fb = closeDay(overview.date)
    setResult(fb)
    notifyProgression({ ...fb, achievements: [] })
  }

  if (result?.record) {
    const tier = getScoreTier(result.record.score)
    const positive = (result.record.score ?? 0) >= STREAK_MIN_SCORE
    return (
      <ResponsiveModal
        open={open}
        onOpenChange={handleOpenChange}
        title={isYesterday ? 'Ontem encerrado' : 'Dia concluído'}
        description="Seu resultado foi registrado no histórico."
        footer={
          <Button size="lg" onClick={() => handleOpenChange(false)}>
            Continuar
          </Button>
        }
      >
        <div className="flex flex-col items-center py-2 text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="relative"
          >
            <Burst color={tierColor(score)} />
            <div className="font-display text-[64px] leading-none font-semibold tabular">
              {score === null ? '—' : <AnimatedNumber value={score} duration={1.1} format={(n) => formatNumber(n, 1)} />}
            </div>
          </motion.div>
          <div className="mt-2 text-sm font-medium">
            {tier.label}
          </div>
          <div className="mt-5 grid w-full grid-cols-2 gap-2">
            <div className="rounded-2xl bg-surface p-3">
              <div className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
                <Sparkles className="size-3.5 text-xp" /> Experiência
              </div>
              <div className="mt-1 font-display text-xl font-semibold text-xp tabular">+{result.xp} XP</div>
            </div>
            <div className="rounded-2xl bg-surface p-3">
              <div className="flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
                <Flame className="size-3.5 text-xp" /> Sequência
              </div>
              <div className="mt-1 font-display text-xl font-semibold tabular">{pluralize(result.streak ?? 0, 'dia', 'dias')}</div>
            </div>
          </div>
          {!positive && result.record.score !== null && (
            <p className="mt-4 text-sm text-muted-foreground">
              Dias com nota {formatNumber(STREAK_MIN_SCORE)} ou mais mantêm a sequência. Amanhã é uma nova chance.
            </p>
          )}
          {result.achievements.length > 0 && (
            <div className="mt-4 w-full space-y-2">
              {result.achievements.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-xp/25 bg-xp/8 p-3 text-left">
                  <Award className="size-5 shrink-0 text-xp" />
                  <div>
                    <div className="text-sm font-semibold">{a.title}</div>
                    <div className="text-[12px] text-muted-foreground">{a.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ResponsiveModal>
    )
  }

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={handleOpenChange}
      title={isYesterday ? 'Encerrar ontem' : 'Completar dia'}
      description={isYesterday ? 'Confirme como foi ontem antes de registrar.' : 'Revise como foi o dia antes de registrar.'}
      footer={
        <>
          <Button size="lg" onClick={confirm}>
            {isYesterday ? 'Encerrar ontem' : 'Completar dia'} · {score === null ? '—' : formatNumber(score, 1)}
          </Button>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            Voltar
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-end justify-between rounded-2xl bg-surface p-4">
          <div>
            <div className="text-[12px] font-medium tracking-wide text-muted-foreground uppercase">Nota prevista</div>
            <div className="mt-1 font-display text-[40px] leading-none font-semibold tabular">
              {score === null ? '—' : formatNumber(score, 1)}
              <span className="ml-1 text-base text-muted-foreground">/ 10</span>
            </div>
          </div>
          <div className="text-right text-[13px] text-muted-foreground">
            {overview.breakdown.highlights.map((h) => (
              <div key={h}>{h}</div>
            ))}
          </div>
        </div>

        {awaitingConfirmation.length > 0 && (
          <div className="flex gap-3 rounded-2xl border border-primary/25 bg-primary/8 p-3 text-[13px]">
            <Moon className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <div className="font-medium">Dá para confirmar amanhã</div>
              <div className="text-muted-foreground">
                {awaitingConfirmation.map((h) => h.habit.name).join(', ')} {awaitingConfirmation.length === 1 ? 'é confirmado' : 'são confirmados'} na
                manhã seguinte. Se encerrar agora, {awaitingConfirmation.length === 1 ? 'conta' : 'contam'} como não feito — ou deixe o dia aberto e
                encerre amanhã na revisão.
              </div>
            </div>
          </div>
        )}

        {(pendingHabits > 0 || pendingTasks > 0) && (
          <div className="flex gap-3 rounded-2xl border border-warning/25 bg-warning/8 p-3 text-[13px]">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <div className="font-medium">Ainda há pendências</div>
              <div className="text-muted-foreground">
                {[pendingHabits > 0 && pluralize(pendingHabits, 'hábito', 'hábitos'), pendingTasks > 0 && pluralize(pendingTasks, 'tarefa', 'tarefas')]
                  .filter(Boolean)
                  .join(' e ')}{' '}
                sem concluir. Tarefas pendentes continuam {isYesterday ? 'hoje' : 'amanhã'} como atrasadas.
              </div>
            </div>
          </div>
        )}

        <ScoreBreakdownView breakdown={overview.breakdown} />
      </div>
    </ResponsiveModal>
  )
}

/** Pequena explosão de partículas — celebração rápida e discreta. */
function Burst({ color }: { color: string }) {
  const particles = Array.from({ length: 12 }, (_, i) => i)
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
      {particles.map((i) => {
        const angle = (i / particles.length) * Math.PI * 2
        const dist = 70 + (i % 3) * 14
        return (
          <motion.span
            key={i}
            className="absolute size-1.5 rounded-full"
            style={{ background: i % 3 === 0 ? 'var(--xp)' : color }}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: [0, 1, 0], scale: [0.5, 1, 0.6] }}
            transition={{ duration: 0.9, delay: 0.15, ease: 'easeOut' }}
          />
        )
      })}
    </div>
  )
}
