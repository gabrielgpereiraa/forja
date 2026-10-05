import { getScoreTier, type ScoreTierId } from '@/domain/scoring/tiers'
import { cn, formatScore } from '@/lib/utils'

export const TIER_COLOR: Record<ScoreTierId, string> = {
  legendary: 'var(--tier-legendary)',
  great: 'var(--tier-great)',
  good: 'var(--tier-good)',
  fair: 'var(--tier-fair)',
  low: 'var(--tier-low)',
  empty: 'var(--tier-empty)',
}

export const TIER_INK: Record<ScoreTierId, string> = {
  legendary: 'var(--tier-legendary-fg)',
  great: 'var(--tier-great-fg)',
  good: 'var(--tier-good-fg)',
  fair: 'var(--tier-fair-fg)',
  low: 'var(--tier-low-fg)',
  empty: 'var(--muted-foreground)',
}

export function tierInk(score: number | null | undefined): string {
  return TIER_INK[getScoreTier(score).id]
}

export function tierColor(score: number | null | undefined): string {
  return TIER_COLOR[getScoreTier(score).id]
}

export function ScorePill({ score, live = false, className }: { score: number | null; live?: boolean; className?: string }) {
  const tier = getScoreTier(score)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold tabular',
        'bg-[color-mix(in_oklch,var(--tc)_14%,transparent)] text-foreground',
        tier.id === 'empty' && 'bg-muted text-muted-foreground',
        className,
      )}
      style={{ '--tc': TIER_COLOR[tier.id] } as React.CSSProperties}
    >
      <span className={cn('size-2 rounded-full bg-[var(--tc)]', live && 'animate-pulse', tier.id === 'empty' && 'bg-muted-foreground/40')} />
      {score === null ? tier.label : `${formatScore(score)} · ${tier.label}`}
    </span>
  )
}
