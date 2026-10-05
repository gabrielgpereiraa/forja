import type { CSSProperties } from 'react'
import { Plus } from 'lucide-react'

import { HabitGlyph, habitColorStyle } from '@/components/appearance'
import type { SkillView } from '@/hooks/use-domain'
import { cn } from '@/lib/utils'
import { lastPracticeLabel, rustLevel, sessionsLabel, STATUS_META } from './skill-format'

export function SkillStatusChip({ status, className }: { status: SkillView['snapshot']['status']; className?: string }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
        meta.tone === 'primary' && 'bg-primary/14 text-primary',
        meta.tone === 'muted' && 'bg-muted text-muted-foreground',
        meta.tone === 'rust' && 'bg-[color-mix(in_oklch,var(--rust-color)_18%,transparent)] text-[var(--rust-color)]',
        className,
      )}
    >
      <span aria-hidden>{meta.symbol}</span> {meta.label}
    </span>
  )
}

/** Barra de condição: cor da habilidade que oxida conforme a ferrugem. */
export function ConditionBar({ condition, floor, className }: { condition: number; floor: number; className?: string }) {
  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuenow={Math.round(condition)} aria-valuemin={0} aria-valuemax={100} aria-label="Condição">
      <div className="h-full rounded-full bg-[var(--skill-bar)]" style={{ width: `${condition}%`, transition: 'width 700ms cubic-bezier(0.2,0.8,0.2,1)' }} />
      {/* Marca do piso: nunca abaixo daqui */}
      <div className="absolute inset-y-0 w-px bg-foreground/25" style={{ left: `${floor}%` }} aria-hidden />
    </div>
  )
}

export function SkillCard({ view, onOpen, onPractice }: { view: SkillView; onOpen: () => void; onPractice: () => void }) {
  const { skill, snapshot: s } = view
  const rust = rustLevel(s)
  return (
    <div
      style={{ ...habitColorStyle(skill.color), '--rust': rust } as CSSProperties}
      className="habit-color skill-card relative overflow-hidden rounded-2xl border bg-card transition-colors hover:border-[color-mix(in_oklch,var(--hc)_30%,transparent)]"
    >
      <div className="skill-patina" aria-hidden />
      <button type="button" onClick={onOpen} className="relative block w-full p-4 pb-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-2xl">
        <div className="flex items-start gap-3">
          <HabitGlyph icon={skill.icon} color={skill.color} className="skill-glyph" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{skill.name}</div>
            <div className="text-[12px] text-muted-foreground">Nível {s.level}</div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl leading-none font-semibold tabular">{Math.round(s.condition)}%</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">condição</div>
          </div>
        </div>
        <ConditionBar condition={s.condition} floor={s.minimumCondition} className="mt-3" />
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
          <SkillStatusChip status={s.status} />
          <span className="tabular">{sessionsLabel(s)}</span>
        </div>
      </button>
      <div className="relative flex items-center justify-between gap-2 border-t px-4 py-2">
        <span className="truncate text-[12px] text-muted-foreground">{lastPracticeLabel(s)}</span>
        <button
          type="button"
          onClick={onPractice}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[13px] font-medium text-[var(--hc)] transition-colors hover:bg-[color-mix(in_oklch,var(--hc)_12%,transparent)]"
        >
          <Plus className="size-3.5" /> Prática
        </button>
      </div>
    </div>
  )
}
