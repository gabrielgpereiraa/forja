import { Link } from 'react-router'

import { ProgressRing } from '@/components/progress/progress-ring'
import { usePlayer } from '@/hooks/use-domain'
import { useToday } from '@/hooks/use-today'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'

/** Avatar com anel de XP do nível — atalho para o Perfil no celular. */
export function ProfileButton({ className }: { className?: string }) {
  const today = useToday()
  const { level } = usePlayer(today)
  const name = useAppStore((s) => s.profile.name)
  return (
    <Link to="/perfil" aria-label={`Perfil · nível ${level.level}`} className={cn('relative inline-flex shrink-0 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', className)}>
      <ProgressRing value={level.progress} size={44} stroke={3} color="var(--xp)">
        <span className="flex size-[34px] items-center justify-center rounded-full bg-surface-2 font-display text-[15px] font-semibold">
          {(name || '?').charAt(0).toUpperCase()}
        </span>
      </ProgressRing>
      <span className="absolute -right-1 -bottom-1 rounded-md border-2 border-background bg-xp px-1 text-[10px] leading-4 font-bold text-xp-foreground tabular">
        {level.level}
      </span>
    </Link>
  )
}
