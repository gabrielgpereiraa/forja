import type { CSSProperties } from 'react'
import {
  Apple,
  Bed,
  Bike,
  BookOpen,
  Brain,
  Code,
  Droplets,
  Dumbbell,
  Footprints,
  GraduationCap,
  Guitar,
  Headphones,
  Heart,
  Languages,
  Leaf,
  Moon,
  Music,
  Palette,
  PenLine,
  Sparkles,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import type { HabitColorKey, HabitIconKey } from '@/domain/models/appearance'
import { cn } from '@/lib/utils'

export const HABIT_ICONS: Record<HabitIconKey, LucideIcon> = {
  guitar: Guitar,
  dumbbell: Dumbbell,
  book: BookOpen,
  code: Code,
  brain: Brain,
  droplets: Droplets,
  languages: Languages,
  music: Music,
  bike: Bike,
  footprints: Footprints,
  apple: Apple,
  moon: Moon,
  heart: Heart,
  pen: PenLine,
  palette: Palette,
  leaf: Leaf,
  wallet: Wallet,
  graduation: GraduationCap,
  headphones: Headphones,
  sparkles: Sparkles,
  target: Target,
  bed: Bed,
}

/** [claro, escuro] — o escuro é mais luminoso para contraste em fundo escuro. */
export const HABIT_COLORS: Record<HabitColorKey, { label: string; light: string; dark: string }> = {
  lime: { label: 'Lima', light: 'oklch(0.6 0.17 132)', dark: 'oklch(0.86 0.19 128)' },
  emerald: { label: 'Esmeralda', light: 'oklch(0.58 0.13 162)', dark: 'oklch(0.77 0.14 162)' },
  sky: { label: 'Céu', light: 'oklch(0.58 0.13 235)', dark: 'oklch(0.77 0.12 232)' },
  indigo: { label: 'Índigo', light: 'oklch(0.52 0.18 275)', dark: 'oklch(0.7 0.15 275)' },
  violet: { label: 'Violeta', light: 'oklch(0.55 0.2 300)', dark: 'oklch(0.72 0.17 302)' },
  rose: { label: 'Rosa', light: 'oklch(0.58 0.2 12)', dark: 'oklch(0.72 0.17 12)' },
  orange: { label: 'Laranja', light: 'oklch(0.64 0.17 50)', dark: 'oklch(0.78 0.15 55)' },
  amber: { label: 'Âmbar', light: 'oklch(0.66 0.15 80)', dark: 'oklch(0.84 0.14 85)' },
}

export function habitColorStyle(color: HabitColorKey): CSSProperties {
  const c = HABIT_COLORS[color]
  return { '--hc-l': c.light, '--hc-d': c.dark } as CSSProperties
}

export function HabitGlyph({
  icon,
  color,
  size = 'md',
  className,
}: {
  icon: HabitIconKey
  color: HabitColorKey
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const Icon = HABIT_ICONS[icon]
  return (
    <span
      style={habitColorStyle(color)}
      className={cn(
        'habit-color relative inline-flex shrink-0 items-center justify-center text-[var(--hc)]',
        'bg-[color-mix(in_oklch,var(--hc)_14%,transparent)] ring-1 ring-inset ring-[color-mix(in_oklch,var(--hc)_22%,transparent)]',
        size === 'sm' && 'size-8 rounded-[10px] [&_svg]:size-4',
        size === 'md' && 'size-10 rounded-xl [&_svg]:size-[18px]',
        size === 'lg' && 'size-14 rounded-2xl [&_svg]:size-6',
        className,
      )}
    >
      <Icon strokeWidth={2} />
    </span>
  )
}
