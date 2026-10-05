import { useMemo, useState } from 'react'
import { Anvil, Archive, ChevronDown, Plus } from 'lucide-react'

import { HabitGlyph } from '@/components/appearance'
import { EmptyState, PageHeader, Surface } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useSkillViews } from '@/hooks/use-domain'
import { useToday } from '@/hooks/use-today'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { SkillCard } from './SkillCard'
import { suggestSkillsFromHabits } from './skill-suggestions'

export function SkillsPage() {
  const today = useToday()
  const views = useSkillViews(today)
  const habits = useAppStore((s) => s.habits)
  const links = useAppStore((s) => s.skillLinks)
  const { openSkillForm, openSkillDetail, openPracticeSheet } = useUiStore()
  const [showArchived, setShowArchived] = useState(false)

  const active = views.filter((v) => !v.skill.archived)
  const archived = views.filter((v) => v.skill.archived)
  const suggestions = useMemo(() => suggestSkillsFromHabits(habits, links), [habits, links])
  const counts = {
    evolving: active.filter((v) => v.snapshot.status === 'evolving').length,
    maintaining: active.filter((v) => v.snapshot.status === 'maintaining').length,
    rusting: active.filter((v) => v.snapshot.status === 'rusting').length,
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Habilidades"
        subtitle="Você não perde o que forjou — mas o que não mantém pode enferrujar."
        actions={
          <Button onClick={() => openSkillForm()} className="hidden md:inline-flex">
            <Plus /> Nova habilidade
          </Button>
        }
      />

      {active.length === 0 ? (
        <EmptyState
          icon={Anvil}
          title="Forje sua primeira habilidade"
          description="Habilidades evoluem com a prática dos seus hábitos. Têm nível (o que você conquistou), condição (quão afiada está) e maestria (o quanto está consolidada)."
        >
          {suggestions.slice(0, 4).map((s) => (
            <Button key={s.habit.id} variant="outline" size="sm" onClick={() => openSkillForm(null, { input: s.input, links: s.links })}>
              <HabitGlyph icon={s.input.icon} color={s.input.color} size="sm" className="-ml-1.5 size-6 rounded-md [&_svg]:size-3.5" />
              {s.input.name}
            </Button>
          ))}
          <Button size="sm" onClick={() => openSkillForm()}>
            <Plus /> Personalizada
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[13px] text-muted-foreground">
            <span>
              <span className="font-semibold text-primary tabular">{counts.evolving}</span> evoluindo
            </span>
            <span>
              <span className="font-semibold text-foreground tabular">{counts.maintaining}</span> mantendo
            </span>
            <span>
              <span className={cn('font-semibold tabular', counts.rusting ? 'text-[var(--rust-color)]' : 'text-foreground')}>{counts.rusting}</span> enferrujando
            </span>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {active.map((v) => (
              <li key={v.skill.id}>
                <SkillCard view={v} onOpen={() => openSkillDetail(v.skill.id)} onPractice={() => openPracticeSheet(v.skill.id)} />
              </li>
            ))}
          </ul>

          {suggestions.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Criar a partir dos hábitos</h2>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <Button key={s.habit.id} variant="outline" size="sm" onClick={() => openSkillForm(null, { input: s.input, links: s.links })}>
                    <HabitGlyph icon={s.input.icon} color={s.input.color} size="sm" className="-ml-1.5 size-6 rounded-md [&_svg]:size-3.5" />
                    {s.input.name}
                  </Button>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-2 px-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
            aria-expanded={showArchived}
          >
            <Archive className="size-4" /> Arquivadas · {archived.length}
            <ChevronDown className={cn('size-4 transition-transform', showArchived && 'rotate-180')} />
          </button>
          {showArchived && (
            <Surface className="mt-2 p-1.5">
              {archived.map((v) => (
                <button
                  key={v.skill.id}
                  type="button"
                  onClick={() => openSkillForm(v.skill.id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left opacity-70 hover:bg-accent/50 hover:opacity-100"
                >
                  <HabitGlyph icon={v.skill.icon} color={v.skill.color} size="sm" />
                  <span className="flex-1 truncate text-sm">{v.skill.name}</span>
                  <span className="text-[12px] text-muted-foreground">Nível {v.snapshot.level}</span>
                </button>
              ))}
            </Surface>
          )}
        </div>
      )}
    </div>
  )
}
