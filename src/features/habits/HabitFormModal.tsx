import { useEffect, useMemo, useState } from 'react'
import { Archive, ArchiveRestore, Minus, Plus, Trash2 } from 'lucide-react'

import { HABIT_ICONS, habitColorStyle } from '@/components/appearance'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { WEEKDAY_SHORT, WEEKDAYS_MONDAY_FIRST, type Weekday } from '@/domain/date'
import { ATTRIBUTES } from '@/domain/models/attributes'
import {
  HABIT_CATEGORIES,
  HABIT_CATEGORY_IDS,
  TARGET_UNIT_LABEL,
  TARGET_UNITS,
  type HabitInput,
  type TargetUnit,
} from '@/domain/models/habit'
import { sameSchedule, sameTarget } from '@/domain/rules/habit-goal-history'
import { useToday } from '@/hooks/use-today'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { formatSchedule } from './habit-format'
import { HABIT_TEMPLATES } from './habit-templates'

const EMPTY: HabitInput = {
  name: '',
  description: '',
  category: 'health',
  schedule: { weeklyGoal: 4, days: null },
  target: null,
  icon: 'target',
  color: 'lime',
  confirmNextDay: false,
}

type TargetMode = 'none' | 'minutes' | 'amount'

const PRESETS: Record<TargetUnit, number[]> = {
  minutes: [10, 15, 20, 30, 45, 60],
  times: [1, 2, 3, 5],
  pages: [10, 20, 30, 50],
  glasses: [4, 6, 8, 10],
  km: [2, 3, 5, 10],
}

const Field = FormField

/** Criação/edição de hábito. Campos essenciais primeiro; avançados recolhidos. */
export function HabitFormModal() {
  const state = useUiStore((s) => s.habitForm)
  const close = useUiStore((s) => s.closeHabitForm)
  const habits = useAppStore((s) => s.habits)
  const createHabit = useAppStore((s) => s.createHabit)
  const updateHabit = useAppStore((s) => s.updateHabit)
  const setHabitArchived = useAppStore((s) => s.setHabitArchived)
  const deleteHabit = useAppStore((s) => s.deleteHabit)
  const today = useToday()

  const editing = state.open && state.habitId ? habits.find((h) => h.id === state.habitId) ?? null : null
  const [form, setForm] = useState<HabitInput>(EMPTY)
  const [showDescription, setShowDescription] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!state.open) return
    const initial: HabitInput = editing
      ? {
          name: editing.name,
          description: editing.description ?? '',
          category: editing.category,
          schedule: editing.schedule,
          target: editing.target,
          icon: editing.icon,
          color: editing.color,
          confirmNextDay: Boolean(editing.confirmNextDay),
        }
      : { ...EMPTY, ...state.preset }
    setForm(initial)
    setShowDescription(Boolean(initial.description))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, state.open && state.habitId])

  const set = <K extends keyof HabitInput>(key: K, value: HabitInput[K]) => setForm((f) => ({ ...f, [key]: value }))
  const fixedDays = form.schedule.days !== null
  const targetMode: TargetMode = !form.target ? 'none' : form.target.unit === 'minutes' ? 'minutes' : 'amount'
  const valid = form.name.trim().length > 0 && (!fixedDays || (form.schedule.days?.length ?? 0) > 0)
  const attribute = ATTRIBUTES[HABIT_CATEGORIES[form.category].attribute]
  const goalChanged =
    editing !== null && (!sameSchedule(editing.schedule, form.schedule) || !sameTarget(editing.target, form.target ?? null))

  const templates = useMemo(() => HABIT_TEMPLATES.filter((t) => !habits.some((h) => h.name === t.name && !h.archived)), [habits])

  const save = () => {
    if (!valid) return
    if (editing) updateHabit(editing.id, form, today)
    else createHabit(form, today)
    close()
  }

  const toggleDay = (d: Weekday) => {
    const days = form.schedule.days ?? []
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d]
    set('schedule', { weeklyGoal: Math.max(1, next.length), days: next })
  }

  return (
    <>
      <ResponsiveModal
        open={state.open}
        onOpenChange={(o) => !o && close()}
        title={editing ? 'Editar hábito' : 'Novo hábito'}
        description={editing ? undefined : 'Um compromisso recorrente, medido pela frequência na semana.'}
        footer={
          <>
            <Button size="lg" onClick={save} disabled={!valid}>
              {editing ? 'Salvar alterações' : 'Salvar hábito'}
            </Button>
            {editing && (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1 text-muted-foreground"
                  onClick={() => {
                    setHabitArchived(editing.id, !editing.archived)
                    close()
                  }}
                >
                  {editing.archived ? <ArchiveRestore /> : <Archive />}
                  {editing.archived ? 'Reativar' : 'Arquivar'}
                </Button>
                <Button variant="ghost" className="flex-1 text-danger hover:text-danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Excluir
                </Button>
              </div>
            )}
          </>
        }
      >
        <div className="space-y-5 pb-1">
          {!editing && templates.length > 0 && !form.name && (
            <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
              {templates.map((t) => {
                const Icon = HABIT_ICONS[t.icon]
                return (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setForm({ ...t, description: '' })}
                    style={habitColorStyle(t.color)}
                    className="habit-color inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border bg-surface px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Icon className="size-3.5 text-[var(--hc)]" /> {t.name}
                  </button>
                )
              })}
            </div>
          )}

          <Field label="Nome">
            <div className="flex gap-2">
              <span
                style={habitColorStyle(form.color)}
                className="habit-color flex size-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--hc)_14%,transparent)] text-[var(--hc)] ring-1 ring-inset ring-[color-mix(in_oklch,var(--hc)_25%,transparent)]"
              >
                {(() => {
                  const Icon = HABIT_ICONS[form.icon]
                  return <Icon className="size-5" />
                })()}
              </span>
              <Input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Ex.: Treinar guitarra"
                maxLength={60}
                autoFocus={!editing}
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
            </div>
            {!showDescription ? (
              <button type="button" className="text-[13px] text-muted-foreground hover:text-foreground" onClick={() => setShowDescription(true)}>
                + Adicionar descrição
              </button>
            ) : (
              <Textarea
                value={form.description ?? ''}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Por que esse hábito importa? (opcional)"
                maxLength={200}
                rows={2}
              />
            )}
          </Field>

          <Field label="Frequência" hint={formatSchedule(form)}>
            {!fixedDays ? (
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Vezes por semana">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={form.schedule.weeklyGoal === n}
                    onClick={() => set('schedule', { weeklyGoal: n, days: null })}
                    className={cn(
                      'h-11 flex-1 rounded-xl border text-[15px] font-semibold tabular transition-colors',
                      form.schedule.weeklyGoal === n ? 'border-primary/60 bg-primary/12' : 'bg-surface text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {n}
                    <span className="text-[11px] font-medium text-muted-foreground">x</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5" role="group" aria-label="Dias da semana">
                {WEEKDAYS_MONDAY_FIRST.map((d) => {
                  const on = form.schedule.days?.includes(d) ?? false
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleDay(d)}
                      className={cn(
                        'h-11 flex-1 rounded-xl border text-[13px] font-semibold transition-colors',
                        on ? 'border-primary/60 bg-primary/12' : 'bg-surface text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {WEEKDAY_SHORT[d]}
                    </button>
                  )
                })}
              </div>
            )}
            <label className="flex items-center justify-between gap-3 rounded-xl px-1 py-1 text-[13px] text-muted-foreground">
              <span>Dias fixos da semana</span>
              <Switch
                checked={fixedDays}
                onCheckedChange={(on) =>
                  set(
                    'schedule',
                    on
                      ? { weeklyGoal: Math.min(form.schedule.weeklyGoal, 5), days: ([1, 3, 5, 2, 4, 6, 0] as Weekday[]).slice(0, form.schedule.weeklyGoal) }
                      : { weeklyGoal: form.schedule.days?.length || 4, days: null },
                  )
                }
              />
            </label>
            <label className="flex items-start justify-between gap-3 rounded-xl px-1 py-1 text-[13px] text-muted-foreground">
              <span>
                Confirmar na manhã seguinte
                <span className="mt-0.5 block text-[12px] text-muted-foreground/75">
                  Para o que só dá para saber depois, como dormir cedo. Aparece na revisão de ontem.
                </span>
              </span>
              <Switch checked={Boolean(form.confirmNextDay)} onCheckedChange={(on) => set('confirmNextDay', on)} className="mt-0.5" />
            </label>
          </Field>

          <Field label="Meta por sessão" hint="opcional">
            <ChipGroup<TargetMode>
              value={targetMode}
              onChange={(m) =>
                set('target', m === 'none' ? null : m === 'minutes' ? { amount: 30, unit: 'minutes' } : { amount: 20, unit: 'pages' })
              }
              options={[
                { value: 'none', label: 'Só concluir' },
                { value: 'minutes', label: 'Tempo' },
                { value: 'amount', label: 'Quantidade' },
              ]}
            />
            {form.target && (
              <div className="space-y-2 rounded-2xl bg-surface p-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Diminuir"
                    onClick={() => form.target && set('target', { ...form.target, amount: Math.max(1, form.target.amount - (form.target.unit === 'minutes' ? 5 : 1)) })}
                  >
                    <Minus />
                  </Button>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    className="h-10 w-20 text-center font-display text-lg font-semibold tabular"
                    value={form.target.amount}
                    onChange={(e) => form.target && set('target', { ...form.target, amount: Math.max(0, Number(e.target.value) || 0) })}
                    aria-label="Quantidade da meta"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Aumentar"
                    onClick={() => form.target && set('target', { ...form.target, amount: form.target.amount + (form.target.unit === 'minutes' ? 5 : 1) })}
                  >
                    <Plus />
                  </Button>
                  {form.target.unit === 'minutes' ? (
                    <span className="text-sm text-muted-foreground">minutos</span>
                  ) : (
                    <select
                      value={form.target.unit}
                      onChange={(e) => form.target && set('target', { ...form.target, unit: e.target.value as TargetUnit })}
                      className="h-10 min-w-0 flex-1 rounded-xl border bg-card px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
                      aria-label="Unidade"
                    >
                      {TARGET_UNITS.filter((u) => u !== 'minutes').map((u) => (
                        <option key={u} value={u}>
                          {TARGET_UNIT_LABEL[u].plural}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS[form.target.unit].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => form.target && set('target', { ...form.target, amount: n })}
                      className={cn(
                        'h-8 rounded-lg border px-2.5 text-[13px] font-medium tabular',
                        form.target?.amount === n ? 'border-primary/60 bg-primary/12' : 'bg-card text-muted-foreground',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Field>

          {goalChanged && (
            <p className="-mt-2 rounded-xl bg-surface px-3 py-2 text-[12px] text-muted-foreground">
              A nova meta vale a partir desta semana. Semanas anteriores continuam avaliadas com a meta antiga.
            </p>
          )}

          <Field label="Categoria" hint={`Evolui ${attribute.label}`}>
            <ChipGroup
              scroll
              size="sm"
              value={form.category}
              onChange={(c) => set('category', c)}
              options={HABIT_CATEGORY_IDS.map((id) => ({ value: id, label: HABIT_CATEGORIES[id].label }))}
            />
          </Field>

          <Field label="Ícone">
            <IconPicker value={form.icon} color={form.color} onChange={(icon) => set('icon', icon)} />
          </Field>

          <Field label="Cor">
            <ColorPicker value={form.color} onChange={(color) => set('color', color)} />
          </Field>
        </div>
      </ResponsiveModal>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{editing?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Todo o histórico de sessões e o XP desse hábito serão removidos. Para pausar sem perder dados, prefira arquivar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (editing) deleteHabit(editing.id, today)
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
