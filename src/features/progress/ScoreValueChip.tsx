import type { ScoreItemLabel } from './score-items'
import { cn } from '@/lib/utils'

/** Valor de um item na nota de hoje (v2): "1,1", "0,4 de 1,1", "+1,1", "bônus". */
export function ScoreValueChip({ label, className }: { label: ScoreItemLabel; className?: string }) {
  return (
    <span
      title={label.title}
      aria-label={label.title}
      className={cn(
        'shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular',
        label.done ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {label.text}
    </span>
  )
}
