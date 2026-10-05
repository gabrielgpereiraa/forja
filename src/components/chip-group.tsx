import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface ChipOption<T extends string | number> {
  value: T
  label: ReactNode
  icon?: ReactNode
  ariaLabel?: string
}

/** Seleção única por chips — menos digitação, toque grande. */
export function ChipGroup<T extends string | number>({
  value,
  options,
  onChange,
  className,
  size = 'md',
  scroll = false,
  ariaLabel,
}: {
  value: T | null
  options: ChipOption<T>[]
  onChange: (value: T) => void
  className?: string
  size?: 'sm' | 'md'
  scroll?: boolean
  ariaLabel?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('flex gap-1.5', scroll ? 'no-scrollbar -mx-5 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0' : 'flex-wrap', className)}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.ariaLabel}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] outline-none select-none active:scale-[0.96] focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4',
              size === 'md' ? 'h-10 px-3.5 text-sm' : 'h-8 px-2.5 text-[13px]',
              active
                ? 'border-primary/60 bg-primary/12 text-foreground'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
