import { motion } from 'motion/react'
import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ProgressRing } from './progress/progress-ring'

const checkPath = 'M5 12.5l4.2 4.2L19 7'

function AnimatedCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <motion.path d={checkPath} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.28, ease: 'easeOut' }} />
    </svg>
  )
}

/**
 * Botão de conclusão de hábito: círculo com anel de progresso parcial.
 * Formato redondo = recorrente (hábito). Tarefas usam o quadrado.
 */
export function HabitCheck({
  done,
  progress,
  onToggle,
  disabled,
  label,
}: {
  done: boolean
  progress: number
  onToggle: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done ? 'true' : progress > 0 ? 'mixed' : 'false'}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className="group/check relative -m-1 flex size-12 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <motion.span
        key={done ? 'done' : 'todo'}
        initial={done ? { scale: 0.7 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 18 }}
        className="relative flex size-9 items-center justify-center"
      >
        {done ? (
          <span className="flex size-9 items-center justify-center rounded-full bg-[var(--hc)] text-[var(--hc-fg)] shadow-[0_0_0_4px_color-mix(in_oklch,var(--hc)_18%,transparent)]">
            <AnimatedCheck className="size-[18px]" />
          </span>
        ) : (
          <ProgressRing value={progress} size={36} stroke={3} color="var(--hc)" trackClassName="stroke-[color-mix(in_oklch,var(--muted-foreground)_35%,transparent)]">
            <Check className="size-4 text-muted-foreground/0 transition-colors group-hover/check:text-muted-foreground/60" strokeWidth={3} />
          </ProgressRing>
        )}
      </motion.span>
    </button>
  )
}

/** Checkbox de tarefa (quadrado arredondado). */
export function TaskCheck({
  done,
  onToggle,
  disabled,
  label,
  tone = 'default',
}: {
  done: boolean
  onToggle: () => void
  disabled?: boolean
  label: string
  tone?: 'default' | 'high' | 'overdue'
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className="group/check -m-1.5 flex size-11 shrink-0 items-center justify-center rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <motion.span
        key={done ? 'done' : 'todo'}
        initial={done ? { scale: 0.7 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 18 }}
        className={cn(
          'flex size-[22px] items-center justify-center rounded-[7px] border-2 transition-colors',
          done
            ? 'border-primary bg-primary text-primary-foreground'
            : cn(
                'border-muted-foreground/40 group-hover/check:border-muted-foreground/70',
                tone === 'high' && 'border-warning/70',
                tone === 'overdue' && 'border-danger/70',
              ),
        )}
      >
        {done && <AnimatedCheck className="size-3.5" />}
      </motion.span>
    </button>
  )
}
