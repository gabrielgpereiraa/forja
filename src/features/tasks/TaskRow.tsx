import { Flag } from 'lucide-react'

import { TaskCheck } from '@/components/check-button'
import type { ISODate } from '@/domain/date'
import type { Task } from '@/domain/models/task'
import { cn } from '@/lib/utils'
import { dueLabel } from './task-format'

export function TaskRow({
  task,
  today,
  onToggle,
  onOpen,
  locked,
  showDate = true,
  lateText,
}: {
  task: Task
  today: ISODate
  onToggle: () => void
  onOpen: () => void
  locked?: boolean
  showDate?: boolean
  lateText?: string | null
}) {
  const due = dueLabel(task, today)
  const overdue = due?.tone === 'danger'
  const label = lateText ?? (showDate || overdue ? due?.text : null)

  return (
    <div className="group flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-accent/50">
      <TaskCheck
        done={task.completed}
        onToggle={onToggle}
        disabled={locked}
        label={task.completed ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
        tone={overdue ? 'overdue' : task.priority === 'high' ? 'high' : 'default'}
      />
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 rounded-lg py-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <div
          className={cn(
            'truncate text-[15px] transition-colors',
            task.completed && 'text-muted-foreground line-through decoration-muted-foreground/40',
          )}
        >
          {task.title}
        </div>
        {(label || task.priority !== 'normal') && !task.completed && (
          <div className="mt-0.5 flex items-center gap-2 text-[12px]">
            {label && <span className={cn(overdue || lateText ? 'text-danger' : 'text-muted-foreground')}>{label}</span>}
            {task.priority === 'high' && (
              <span className="inline-flex items-center gap-1 text-warning">
                <Flag className="size-3" /> Alta
              </span>
            )}
            {task.priority === 'low' && <span className="text-muted-foreground/70">Baixa</span>}
          </div>
        )}
      </button>
    </div>
  )
}
