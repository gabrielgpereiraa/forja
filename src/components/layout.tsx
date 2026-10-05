import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ProfileButton } from './profile-button'

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
  profile = true,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
  /** Mostra o atalho do Perfil no celular (onde o Perfil não está na barra inferior). */
  profile?: boolean
}) {
  return (
    <header className={cn('flex items-start justify-between gap-4 pt-2 pb-5', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[13px] font-medium text-muted-foreground">{eyebrow}</div>}
        <h1 className="font-display text-[28px] leading-[1.1] font-semibold md:text-[32px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {(actions || profile) && (
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {profile && <ProfileButton className="md:hidden" />}
        </div>
      )}
    </header>
  )
}

export function SectionHeader({
  icon: Icon,
  title,
  meta,
  action,
  hint,
}: {
  icon?: LucideIcon
  title: ReactNode
  meta?: ReactNode
  action?: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3 px-1">
      <div className="flex min-w-0 items-center gap-2">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
        {meta && <span className="text-[13px] font-medium text-muted-foreground/80 tabular">{meta}</span>}
        {hint && <span className="hidden text-xs text-muted-foreground/70 sm:inline">· {hint}</span>}
      </div>
      {action}
    </div>
  )
}

export function Surface({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground', className)} {...props}>
      {children}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center rounded-2xl border border-dashed px-6 py-8 text-center', className)}>
      <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-surface-2 text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  )
}

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  className,
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  icon?: LucideIcon
  accent?: string
  className?: string
}) {
  return (
    <div className={cn('rounded-2xl border bg-card p-3.5', className)}>
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" style={accent ? { color: accent } : undefined} />}
        {label}
      </div>
      <div className="mt-1.5 font-display text-[22px] leading-none font-semibold tabular">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-muted-foreground">{sub}</div>}
    </div>
  )
}
