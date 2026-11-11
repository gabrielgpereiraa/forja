import { useEffect, useState } from 'react'
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react'

import { HABIT_ICONS, HabitGlyph, habitColorStyle } from '@/components/appearance'
import { ChipGroup } from '@/components/chip-group'
import { ColorPicker, FormField, IconPicker } from '@/components/form-pickers'
import { ResponsiveModal } from '@/components/responsive-modal'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ATTRIBUTES } from '@/domain/models/attributes'
import { HABIT_CATEGORIES, HABIT_CATEGORY_IDS } from '@/domain/models/habit'
import type { SkillInput } from '@/domain/models/skill'
import { useToday } from '@/hooks/use-today'
import { cn } from '@/lib/utils'
import { CONTRIBUTION_WEIGHTS, SKILL_DELETE_LOCKED_REASON, skillHasClosedHistory, type LinkInput } from '@/services/skill-commands'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { toast } from 'sonner'

const EMPTY: SkillInput = {
  name: '',
  description: '',
  category: 'creative',
  icon: 'sparkles',
  color: 'violet',
  maintenancePerWeek: 2,
  sessionMinutes: 30,
}

/** Criação/edição de habilidade: o essencial + quais hábitos a treinam. */
export function SkillFormModal() {
  const state = useUiStore((s) => s.skillForm)
  const close = useUiStore((s) => s.closeSkillForm)
  const skills = useAppStore((s) => s.skills)
  const habits = useAppStore((s) => s.habits)
  const allLinks = useAppStore((s) => s.skillLinks)
  const createSkill = useAppStore((s) => s.createSkill)
  const updateSkill = useAppStore((s) => s.updateSkill)
  const setArchived = useAppStore((s) => s.setSkillArchived)
  const deleteSkill = useAppStore((s) => s.deleteSkill)
  const today = useToday()
  const records = useAppStore((s) => s.records)
  const practices = useAppStore((s) => s.skillPractices)

  const editing = state.open && state.skillId ? skills.find((s) => s.id === state.skillId) ?? null : null
  const deleteLocked = editing ? skillHasClosedHistory({ records, skillPractices: practices }, editing.id, today) : false
  const [form, setForm] = useState<SkillInput>(EMPTY)
  const [links, setLinks] = useState<Map<string, number>>(new Map())
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!state.open) return
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? '',
        category: editing.category,
        icon: editing.icon,
        color: editing.color,
        maintenancePerWeek: editing.maintenancePerWeek,
        sessionMinutes: editing.sessionMinutes,
      })
      setLinks(new Map(allLinks.filter((l) => l.skillId === editing.id).map((l) => [l.habitId, l.weight])))
    } else {
      setForm({ ...EMPTY, ...state.preset?.input })
      setLinks(new Map((state.preset?.links ?? []).map((l) => [l.habitId, l.weight])))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, state.open && state.skillId])

  const set = <K extends keyof SkillInput>(key: K, value: SkillInput[K]) => setForm((f) => ({ ...f, [key]: value }))
  const valid = form.name.trim().length > 0
  const activeHabits = habits.filter((h) => !h.archived)
  const linkList: LinkInput[] = [...links].map(([habitId, weight]) => ({ habitId, weight }))
  const Icon = HABIT_ICONS[form.icon]

  const save = () => {
    if (!valid) return
    if (editing) updateSkill(editing.id, form, linkList, today)
    else {
      const r = createSkill(form, linkList, today)
      if (r.imported > 0) toast('Habilidade criada', { description: `${r.imported} práticas importadas do histórico dos hábitos.` })
    }
    close()
  }

  const toggleLink = (habitId: string) =>
    setLinks((m) => {
      const next = new Map(m)
      if (next.has(habitId)) next.delete(habitId)
      else next.set(habitId, 1)
      return next
    })

  return (
    <>
      <ResponsiveModal
        open={state.open}
        onOpenChange={(o) => !o && close()}
        title={editing ? 'Editar habilidade' : 'Nova habilidade'}
        description={editing ? undefined : 'Algo que você está forjando — evolui com a prática e enferruja se ficar parado.'}
        footer={
          <>
            <Button size="lg" onClick={save} disabled={!valid}>
              {editing ? 'Salvar alterações' : 'Criar habilidade'}
            </Button>
            {editing && (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1 text-muted-foreground"
                  onClick={() => {
                    setArchived(editing.id, !editing.archived)
                    close()
                  }}
                >
                  {editing.archived ? <ArchiveRestore /> : <Archive />}
                  {editing.archived ? 'Reativar' : 'Arquivar'}
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1 text-danger hover:text-danger"
                  disabled={deleteLocked}
                  title={deleteLocked ? SKILL_DELETE_LOCKED_REASON : undefined}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 /> Excluir
                </Button>
              </div>
            )}
            {editing && deleteLocked && <p className="text-center text-[12px] text-muted-foreground">{SKILL_DELETE_LOCKED_REASON}</p>}
          </>
        }
      >
        <div className="space-y-5 pb-1">
          <FormField label="Nome">
            <div className="flex gap-2">
              <span
                style={habitColorStyle(form.color)}
                className="habit-color flex size-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--hc)_14%,transparent)] text-[var(--hc)] ring-1 ring-inset ring-[color-mix(in_oklch,var(--hc)_25%,transparent)]"
              >
                <Icon className="size-5" />
              </span>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Guitarra" maxLength={40} autoFocus={!editing} onKeyDown={(e) => e.key === 'Enter' && save()} />
            </div>
          </FormField>

          <FormField label="Manutenção" hint={`${form.maintenancePerWeek}x por semana para não enferrujar`}>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Sessões por semana para manter">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={form.maintenancePerWeek === n}
                  onClick={() => set('maintenancePerWeek', n)}
                  className={cn(
                    'h-11 flex-1 rounded-xl border text-[15px] font-semibold tabular transition-colors',
                    form.maintenancePerWeek === n ? 'border-primary/60 bg-primary/12' : 'bg-surface text-muted-foreground hover:text-foreground',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </FormField>

          <FormField label="Uma sessão equivale a" hint="referência">
            <ChipGroup<number>
              size="sm"
              value={form.sessionMinutes}
              onChange={(v) => set('sessionMinutes', v)}
              options={[15, 20, 30, 45, 60].map((m) => ({ value: m, label: `${m} min` }))}
            />
          </FormField>

          <FormField label="Treinada pelos hábitos" hint={links.size ? `${links.size} vinculado${links.size > 1 ? 's' : ''}` : 'opcional'}>
            {activeHabits.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Crie hábitos para que as sessões contem aqui automaticamente.</p>
            ) : (
              <ul className="space-y-1.5">
                {activeHabits.map((h) => {
                  const weight = links.get(h.id)
                  const on = weight !== undefined
                  return (
                    <li key={h.id} className={cn('rounded-xl border p-2 transition-colors', on ? 'border-primary/40 bg-primary/5' : 'bg-surface')}>
                      <button type="button" onClick={() => toggleLink(h.id)} className="flex w-full items-center gap-2.5 text-left" aria-pressed={on}>
                        <HabitGlyph icon={h.icon} color={h.color} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm">{h.name}</span>
                        <span className={cn('text-[12px]', on ? 'font-medium text-primary' : 'text-muted-foreground')}>{on ? 'Vinculado' : 'Vincular'}</span>
                      </button>
                      {on && (
                        <div className="mt-2 flex items-center gap-1.5 pl-[42px]">
                          <span className="text-[12px] text-muted-foreground">Contribui</span>
                          {CONTRIBUTION_WEIGHTS.map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => setLinks((m) => new Map(m).set(h.id, w))}
                              className={cn(
                                'h-7 rounded-lg border px-2 text-[12px] font-medium tabular',
                                weight === w ? 'border-primary/60 bg-primary/12' : 'bg-card text-muted-foreground',
                              )}
                            >
                              {Math.round(w * 100)}%
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {!editing && links.size > 0 && (
              <p className="text-[12px] text-muted-foreground">As sessões que você já registrou nesses hábitos entram no histórico da habilidade.</p>
            )}
          </FormField>

          <FormField label="Categoria" hint={`Atributo: ${ATTRIBUTES[HABIT_CATEGORIES[form.category].attribute].label}`}>
            <ChipGroup
              scroll
              size="sm"
              value={form.category}
              onChange={(c) => set('category', c)}
              options={HABIT_CATEGORY_IDS.map((id) => ({ value: id, label: HABIT_CATEGORIES[id].label }))}
            />
          </FormField>

          <FormField label="Ícone">
            <IconPicker value={form.icon} color={form.color} onChange={(icon) => set('icon', icon)} />
          </FormField>

          <FormField label="Cor">
            <ColorPicker value={form.color} onChange={(color) => set('color', color)} />
          </FormField>

          <FormField label="Descrição" hint="opcional">
            <Textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} rows={2} maxLength={200} placeholder="O que você quer dominar?" />
          </FormField>
        </div>
      </ResponsiveModal>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{editing?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O histórico de práticas e o nível desta habilidade serão apagados. Seus hábitos e registros continuam intactos. Para pausar sem perder nada, prefira arquivar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (editing) deleteSkill(editing.id)
                setConfirmDelete(false)
                close()
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
