import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'

import { ResponsiveModal } from '@/components/responsive-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { TaskInput } from '@/domain/models/task'
import { isTaskDeleteLocked, isTaskLocked, TASK_DELETE_LOCKED_REASON } from '@/domain/rules/task-agenda'
import { useToday } from '@/hooks/use-today'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { useTaskActions, withPlanFeedback } from '@/features/feedback/use-actions'
import { TaskDatePicker, TaskPriorityPicker } from './TaskDatePriority'

export function TaskFormModal() {
  const state = useUiStore((s) => s.taskForm)
  const close = useUiStore((s) => s.closeTaskForm)
  const tasks = useAppStore((s) => s.tasks)
  const records = useAppStore((s) => s.records)
  const createTask = useAppStore((s) => s.createTask)
  const updateTask = useAppStore((s) => s.updateTask)
  const { remove, toggle } = useTaskActions()
  const today = useToday()

  const editing = state.open && state.taskId ? tasks.find((t) => t.id === state.taskId) ?? null : null
  const deleteLocked = editing ? isTaskDeleteLocked(editing, records) : false
  const [form, setForm] = useState<TaskInput>({ title: '', description: '', dueDate: today, priority: 'normal' })

  useEffect(() => {
    if (!state.open) return
    setForm(
      editing
        ? { title: editing.title, description: editing.description ?? '', dueDate: editing.dueDate, priority: editing.priority }
        : { title: '', description: '', dueDate: today, priority: 'normal', ...state.preset },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, state.open && state.taskId])

  const valid = form.title.trim().length > 0
  const save = () => {
    if (!valid) return
    // Nota v2: avisa como o plano e a nota até agora mudaram (criar, remarcar ou mudar prioridade).
    withPlanFeedback(today, () => (editing ? updateTask(editing.id, form) : createTask(form, today)))
    close()
  }

  return (
    <ResponsiveModal
      open={state.open}
      onOpenChange={(o) => !o && close()}
      title={editing ? 'Editar tarefa' : 'Nova tarefa'}
      description={editing ? undefined : 'Uma ação pontual para resolver.'}
      footer={
        <>
          <Button size="lg" onClick={save} disabled={!valid}>
            {editing ? 'Salvar' : 'Salvar tarefa'}
          </Button>
          {editing && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1 text-muted-foreground"
                disabled={isTaskLocked(editing, records, today)}
                title={isTaskLocked(editing, records, today) ? 'Dia encerrado' : undefined}
                onClick={() => {
                  toggle(editing.id, today)
                  close()
                }}
              >
                {editing.completed ? 'Reabrir tarefa' : 'Marcar como concluída'}
              </Button>
              <Button
                variant="ghost"
                className="text-danger hover:text-danger"
                disabled={deleteLocked}
                title={deleteLocked ? TASK_DELETE_LOCKED_REASON : undefined}
                onClick={() => {
                  remove(editing.id)
                  close()
                }}
              >
                <Trash2 /> Excluir
              </Button>
            </div>
          )}
          {deleteLocked && <p className="text-center text-[12px] text-muted-foreground">{TASK_DELETE_LOCKED_REASON}</p>}
        </>
      }
    >
      <div className="space-y-5 pb-1">
        <div className="space-y-2">
          <Label htmlFor="task-title">Título</Label>
          <Input
            id="task-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Ex.: Limpar tênis"
            maxLength={120}
            autoFocus={!editing}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </div>
        <div className="space-y-2">
          <Label>Data</Label>
          <TaskDatePicker value={form.dueDate} onChange={(d) => setForm((f) => ({ ...f, dueDate: d }))} today={today} />
        </div>
        <div className="space-y-2">
          <Label>Prioridade</Label>
          <TaskPriorityPicker value={form.priority} onChange={(p) => setForm((f) => ({ ...f, priority: p }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-desc">Descrição</Label>
          <Textarea
            id="task-desc"
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Detalhes (opcional)"
            rows={2}
            maxLength={500}
          />
        </div>
      </div>
    </ResponsiveModal>
  )
}
