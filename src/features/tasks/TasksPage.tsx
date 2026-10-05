import { useMemo, useState } from 'react'
import { CalendarClock, CheckCheck, Inbox, ListTodo, Plus } from 'lucide-react'

import { EmptyState, PageHeader, Surface } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { relativeDayLabel, type ISODate } from '@/domain/date'
import type { Task } from '@/domain/models/task'
import { bucketOf, sortTaskItems, type TaskBucket } from '@/domain/rules/task-agenda'
import { useToday } from '@/hooks/use-today'
import { useAppStore } from '@/store/app-store'
import { useUiStore } from '@/store/ui-store'
import { useTaskActions } from '@/features/feedback/use-actions'
import { TaskComposer } from './TaskComposer'
import { TaskRow } from './TaskRow'

function sortTasks(tasks: Task[]): Task[] {
  return sortTaskItems(tasks.map((task) => ({ task, role: 'due' as const, daysLate: 0, doneOnDay: false }))).map((i) => i.task)
}

export function TasksPage() {
  const today = useToday()
  const tasks = useAppStore((s) => s.tasks)
  const openTaskForm = useUiStore((s) => s.openTaskForm)
  const { toggle } = useTaskActions()
  const [tab, setTab] = useState<TaskBucket>('today')

  const buckets = useMemo(() => {
    const out: Record<TaskBucket, Task[]> = { today: [], upcoming: [], someday: [], done: [] }
    for (const t of tasks) {
      // Concluídas hoje continuam visíveis em "Hoje" para dar sensação de progresso.
      if (t.completed && t.completedOn === today && t.dueDate !== null && t.dueDate <= today) out.today.push(t)
      out[bucketOf(t, today)].push(t)
    }
    out.today = [...sortTasks(out.today.filter((t) => t.dueDate && t.dueDate < today && !t.completed)), ...sortTasks(out.today.filter((t) => !(t.dueDate && t.dueDate < today && !t.completed)))]
    out.upcoming.sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    out.someday = sortTasks(out.someday)
    out.done.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    out.done = out.done.slice(0, 50)
    return out
  }, [tasks, today])

  const upcomingGroups = useMemo(() => {
    const groups = new Map<ISODate, Task[]>()
    for (const t of buckets.upcoming) {
      const d = t.dueDate!
      groups.set(d, [...(groups.get(d) ?? []), t])
    }
    return [...groups.entries()]
  }, [buckets.upcoming])

  const pendingToday = buckets.today.filter((t) => !t.completed).length
  const overdue = buckets.today.filter((t) => !t.completed && t.dueDate! < today).length
  const defaultDate: ISODate | null = tab === 'someday' ? null : today

  const row = (t: Task) => <TaskRow key={t.id} task={t} today={today} onToggle={() => toggle(t.id, today)} onOpen={() => openTaskForm(t.id)} />

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Tarefas"
        subtitle="Ações pontuais para resolver — sem recorrência."
        actions={
          <Button onClick={() => openTaskForm()} className="hidden md:inline-flex">
            <Plus /> Nova tarefa
          </Button>
        }
      />

      <TaskComposer key={tab} today={today} defaultDate={defaultDate} className="mb-4" placeholder={tab === 'someday' ? 'Adicionar para algum dia…' : 'Adicionar tarefa…'} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TaskBucket)}>
        <TabsList className="w-full">
          <TabsTrigger value="today">
            Hoje {pendingToday > 0 && <span className="tabular text-muted-foreground">{pendingToday}</span>}
          </TabsTrigger>
          <TabsTrigger value="upcoming">Próximas</TabsTrigger>
          <TabsTrigger value="someday">Sem data</TabsTrigger>
          <TabsTrigger value="done">Feitas</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          {overdue > 0 && (
            <p className="mb-2 px-1 text-[13px] text-danger">
              {overdue} atrasada{overdue > 1 ? 's' : ''} — elas reduzem um pouco a nota do dia até serem resolvidas.
            </p>
          )}
          {buckets.today.length === 0 ? (
            <EmptyState icon={CheckCheck} title="Nada para hoje" description="Seu dia está livre de pendências. Use o campo acima para adicionar algo rápido." />
          ) : (
            <Surface className="p-1.5">{buckets.today.map(row)}</Surface>
          )}
        </TabsContent>

        <TabsContent value="upcoming">
          {upcomingGroups.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nada agendado" description="Tarefas com data futura aparecem aqui, agrupadas por dia." />
          ) : (
            <div className="space-y-4">
              {upcomingGroups.map(([date, list]) => (
                <section key={date}>
                  <h3 className="mb-1.5 px-1 text-[13px] font-semibold text-muted-foreground">{relativeDayLabel(date, today)}</h3>
                  <Surface className="p-1.5">
                    {list.map((t) => (
                      <TaskRow key={t.id} task={t} today={today} showDate={false} onToggle={() => toggle(t.id, today)} onOpen={() => openTaskForm(t.id)} />
                    ))}
                  </Surface>
                </section>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="someday">
          {buckets.someday.length === 0 ? (
            <EmptyState icon={Inbox} title="Caixa vazia" description="Ideias e coisas sem prazo. Concluir uma delas conta como bônus no dia." />
          ) : (
            <Surface className="p-1.5">{buckets.someday.map(row)}</Surface>
          )}
        </TabsContent>

        <TabsContent value="done">
          {buckets.done.length === 0 ? (
            <EmptyState icon={ListTodo} title="Nenhuma tarefa concluída ainda" description="Cada tarefa concluída gera XP de Disciplina." />
          ) : (
            <Surface className="p-1.5">{buckets.done.map(row)}</Surface>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
