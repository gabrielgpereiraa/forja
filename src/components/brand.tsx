import { cn } from '@/lib/utils'

export const APP_NAME = 'Forja'
export const APP_TAGLINE = 'Seu painel de evolução pessoal'

/**
 * Arquivos da marca em `public/brand/` (gerados a partir de `public/forja-logo.png`):
 * - mark.png / mark-on-light.png → símbolo "F" (fundo escuro / claro)
 * - logo-on-dark.png / logo-on-light.png → símbolo + "FORJA"
 * Cada par alterna automaticamente com o tema (classe `.dark`).
 */
const BRAND = {
  markDark: '/brand/mark.png',
  markLight: '/brand/mark-on-light.png',
  logoDark: '/brand/logo-on-dark.png',
  logoLight: '/brand/logo-on-light.png',
} as const

function ThemedImage({ dark, light, alt, className }: { dark: string; light: string; alt: string; className?: string }) {
  return (
    <>
      <img src={light} alt={alt} draggable={false} className={cn('object-contain select-none dark:hidden', className)} />
      <img src={dark} alt={alt} draggable={false} className={cn('hidden object-contain select-none dark:block', className)} />
    </>
  )
}

/** Símbolo da marca (o "F"). */
export function BrandMark({ className }: { className?: string }) {
  return <ThemedImage dark={BRAND.markDark} light={BRAND.markLight} alt="" className={cn('size-8', className)} />
}

/** Logo completo (símbolo + "FORJA"), para telas de destaque como o onboarding. */
export function BrandLogo({ className }: { className?: string }) {
  return <ThemedImage dark={BRAND.logoDark} light={BRAND.logoLight} alt={APP_NAME} className={cn('h-auto w-40', className)} />
}

/** Símbolo + nome em texto (navegação). */
export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <BrandMark className="size-9" />
      <span className="font-display text-lg font-semibold tracking-tight">{APP_NAME}</span>
    </div>
  )
}
