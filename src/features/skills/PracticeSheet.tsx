import { useState } from 'react'
import { Check } from 'lucide-react'

import { HabitGlyph } from '@/components/appearance'
import { ResponsiveModal } from '@/components/responsive-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToday } from '@/hooks/use-today'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { useSkillActions } from '@/features/feedback/use-actions'
import { primaryHabitOf } from '@/services/skill-commands'

const QUICK = [15, 30, 45, 60] as const

/** Registro rápido: um toque na duração registra e fecha. */
export function PracticeSheet() {
  const skillId = useUiStore((s) => s.practiceSheet)
  const close = useUiStore((s) => s.closePracticeSheet)
  const skill = useAppStore((s) => (skillId ? s.skills.find((x) => x.id === skillId) ?? null : null))
  const habit = useAppStore((s) => (skillId ? primaryHabitOf(s, skillId) : null))
  const today = useToday()
  const closedToday = useAppStore((s) => Boolean(s.records[today]))
  const { practice } = useSkillActions()
  const [custom, setCustom] = useState('')

  if (!skill) return null
  const register = (duration: number | null) => {
    practice(skill.id, duration, today)
    setCustom('')
    close()
  }

  return (
    <ResponsiveModal
      open
      onOpenChange={(o) => !o && close()}
      title={
        <span className="flex items-center gap-3">
          <HabitGlyph icon={skill.icon} color={skill.color} size="sm" />
          Registrar prática
        </span>
      }
      description={
        habit && !closedToday
          ? `${skill.name} · também registra em “${habit.name}”`
          : `${skill.name} · quanto tempo você praticou?`
      }
    >
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-4 gap-2">
          {QUICK.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => register(m)}
              className="flex h-16 flex-col items-center justify-center rounded-2xl border bg-surface transition-colors hover:bg-surface-2 active:scale-[0.97]"
            >
              <span className="font-display text-xl leading-none font-semibold tabular">{m}</span>
              <span className="mt-1 text-[11px] text-muted-foreground">min</span>
            </button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const n = Number(custom)
            if (n > 0) register(Math.min(600, Math.round(n)))
          }}
        >
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            placeholder="Personalizado (min)"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="Minutos personalizados"
          />
          <Button type="submit" variant="secondary" disabled={!(Number(custom) > 0)}>
            Registrar
          </Button>
        </form>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => register(null)}>
          <Check /> Pratiquei (sem medir o tempo)
        </Button>
      </div>
    </ResponsiveModal>
  )
}
