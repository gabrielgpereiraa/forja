import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface ProgressRingProps {
  value: number
  size?: number
  stroke?: number
  /** Cor CSS do traço (ex.: `var(--primary)`). */
  color?: string
  trackClassName?: string
  className?: string
  children?: ReactNode
}

export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  color = 'var(--primary)',
  trackClassName = 'stroke-muted',
  className,
  children,
}: ProgressRingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClassName} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.2, 0.8, 0.2, 1), stroke 300ms' }}
          opacity={v === 0 ? 0 : 1}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  )
}
