import { useState } from 'react'
import { X } from 'lucide-react'

import { HABIT_ICONS, habitColorStyle } from '@/components/appearance'
import type { ISODate } from '@/domain/date'
import { useSkillViews } from '@/hooks/use-domain'
import { useUiStore } from '@/store/ui-store'
import { sessionsNeeded } from './skill-format'

const KEY = 'forja.ui.rustBannerDismissed'

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/**
 * Um único aviso gentil por dia no painel: a habilidade que mais precisa de
 * atenção (enferrujando, ou prestes a começar). Nunca mais de um.
 */
export function SkillRustBanner({ today }: { today: ISODate }) {
  const views = useSkillViews(today)
  const openPracticeSheet = useUiStore((s) => s.openPracticeSheet)
  const openSkillDetail = useUiStore((s) => s.openSkillDetail)
  const [dismissed, setDismissed] = useState(readDismissed)
  if (dismissed === today) return null

  const candidates = views
    .filter((v) => !v.skill.archived)
    .filter((v) => v.snapshot.status === 'rusting' || (v.snapshot.daysUntilRust === 1 && v.snapshot.nextDecay > 0))
    .sort((a, b) => (a.snapshot.status === 'rusting' ? 0 : 1) - (b.snapshot.status === 'rusting' ? 0 : 1) || b.snapshot.level - a.snapshot.level)
  const top = candidates[0]
  if (!top) return null

  const { skill, snapshot: s } = top
  const Icon = HABIT_ICONS[skill.icon]
  const need = sessionsNeeded(s)
  const starting = s.status !== 'rusting'
  const title = starting ? `${skill.name} está começando a enferrujar.` : `${skill.name} está enferrujando.`
  const body = starting
    ? `${need === 1 ? 'Uma sessão hoje mantém' : `${need} sessões esta semana mantêm`} sua habilidade afiada.`
    : `Uma sessão hoje já começa a recuperar sua condição${s.mastery >= 20 ? ' — e sua maestria acelera a volta' : ''}.`

  return (
    <div style={habitColorStyle(skill.color)} className="habit-color mb-4 flex items-start gap-3 rounded-2xl border border-[color-mix(in_oklch,var(--rust-color)_28%,transparent)] bg-[color-mix(in_oklch,var(--rust-color)_7%,transparent)] p-3.5 animate-rise">
      <button type="button" onClick={() => openSkillDetail(skill.id)} className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--rust-color)_16%,transparent)] text-[var(--rust-color)]" aria-label={`Ver ${skill.name}`}>
        <Icon className="size-[18px]" />
      </button>
      <div className="min-w-0 flex-1 text-[13px]">
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground">{body}</div>
        <button type="button" onClick={() => openPracticeSheet(skill.id)} className="mt-1.5 text-[13px] font-medium text-[var(--hc)] hover:underline">
          Registrar prática
        </button>
      </div>
      <button
        type="button"
        className="-m-1 rounded-lg p-1 text-muted-foreground hover:bg-accent"
        aria-label="Dispensar aviso"
        onClick={() => {
          setDismissed(today)
          try {
            window.localStorage.setItem(KEY, today)
          } catch {
            /* armazenamento indisponível */
          }
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
