import type { ReactNode } from 'react'

import { HABIT_COLORS, HABIT_ICONS, habitColorStyle } from '@/components/appearance'
import { Label } from '@/components/ui/label'
import { HABIT_COLOR_KEYS, HABIT_ICON_KEYS, type HabitColorKey, type HabitIconKey } from '@/domain/models/appearance'
import { cn } from '@/lib/utils'

export function FormField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        {hint && <span className="text-[12px] text-muted-foreground/80">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

export function IconPicker({ value, color, onChange }: { value: HabitIconKey; color: HabitColorKey; onChange: (icon: HabitIconKey) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-11">
      {HABIT_ICON_KEYS.map((key) => {
        const Icon = HABIT_ICONS[key]
        const on = value === key
        return (
          <button
            key={key}
            type="button"
            aria-label={key}
            aria-pressed={on}
            onClick={() => onChange(key)}
            style={habitColorStyle(color)}
            className={cn(
              'habit-color flex aspect-square items-center justify-center rounded-xl border transition-colors',
              on ? 'border-[var(--hc)] bg-[color-mix(in_oklch,var(--hc)_14%,transparent)] text-[var(--hc)]' : 'bg-surface text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-[18px]" />
          </button>
        )
      })}
    </div>
  )
}

export function ColorPicker({ value, onChange }: { value: HabitColorKey; onChange: (color: HabitColorKey) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {HABIT_COLOR_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-label={HABIT_COLORS[key].label}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          style={habitColorStyle(key)}
          className={cn(
            'habit-color size-9 rounded-full bg-[var(--hc)] ring-offset-2 ring-offset-popover transition-transform active:scale-90',
            value === key && 'ring-2 ring-[var(--hc)]',
          )}
        />
      ))}
    </div>
  )
}
