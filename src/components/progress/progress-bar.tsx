import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  className?: string
  /** Classe do preenchimento (cor). */
  barClassName?: string
  /** Estilo inline do preenchimento (para cores dinâmicas). */
  color?: string
  size?: 'xs' | 'sm' | 'md'
  label?: string
}

export function ProgressBar({ value, className, barClassName, color, size = 'sm', label }: ProgressBarProps) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={label}
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-muted',
        size === 'xs' && 'h-1',
        size === 'sm' && 'h-1.5',
        size === 'md' && 'h-2.5',
        className,
      )}
    >
      <div
        className={cn('h-full rounded-full bg-primary', barClassName)}
        style={{
          width: `${v * 100}%`,
          background: color,
          transition: 'width 600ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
      />
    </div>
  )
}

/**
 * Barra segmentada: um segmento por sessão da meta semanal (ex.: 3/4).
 * Sessões excedentes aparecem como um "+N".
 */
export function SegmentedProgress({
  done,
  goal,
  color = 'var(--primary)',
  className,
  size = 'sm',
}: {
  done: number
  goal: number
  color?: string
  className?: string
  size?: 'sm' | 'md'
}) {
  const extra = Math.max(0, done - goal)
  return (
    <div className={cn('flex items-center gap-1.5', className)} aria-label={`${done} de ${goal} sessões`}>
      <div className="flex flex-1 gap-1">
        {Array.from({ length: Math.max(goal, 1) }, (_, i) => (
          <div
            key={i}
            className={cn('flex-1 rounded-full bg-muted transition-colors duration-500', size === 'sm' ? 'h-1.5' : 'h-2.5')}
            style={i < done ? { background: color } : undefined}
          />
        ))}
      </div>
      {extra > 0 && (
        <span className="text-[10px] font-semibold tabular" style={{ color }}>
          +{extra}
        </span>
      )}
    </div>
  )
}
