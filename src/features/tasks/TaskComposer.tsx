import { useRef, useState } from 'react'
import { ArrowUp, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ISODate } from '@/domain/date'
import type { TaskPriority } from '@/domain/models/task'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { TaskDatePicker, TaskPriorityPicker } from './TaskDatePriority'
import { withPlanFeedback } from '@/features/feedback/use-actions'

/**
 * Adição rápida de tarefa: digitar + Enter. Data e prioridade aparecem como
 * chips ao focar — o caso comum (hoje, normal) não exige nenhum toque extra.
 */
export function TaskComposer({
  today,
  defaultDate,
  placeholder = 'Adicionar tarefa…',
  className,
  autoExpand = false,
}: {
  today: ISODate
  defaultDate: ISODate | null
  placeholder?: string
  className?: string
  autoExpand?: boolean
}) {
  const createTask = useAppStore((s) => s.createTask)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState<ISODate | null>(defaultDate)
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [focused, setFocused] = useState(autoExpand)
  const inputRef = useRef<HTMLInputElement>(null)
  const expanded = focused || title.length > 0

  const submit = () => {
    const t = title.trim()
    if (!t) return
    withPlanFeedback(today, () => createTask({ title: t, dueDate: date, priority }, today))
    setTitle('')
    setPriority('normal')
    inputRef.current?.focus()
  }

  return (
    <div
      className={cn('rounded-2xl border bg-card transition-[border-color,box-shadow]', expanded && 'border-ring/40 shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_12%,transparent)]', className)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !title) setFocused(autoExpand)
      }}
    >
      <form
        className="flex items-center gap-2 py-1.5 pr-1.5 pl-3.5"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Plus className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          maxLength={120}
          enterKeyHint="done"
          className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/70 md:text-sm"
          aria-label="Título da nova tarefa"
        />
        <Button type="submit" size="icon-sm" disabled={!title.trim()} aria-label="Adicionar tarefa" className={cn(!title.trim() && 'invisible')}>
          <ArrowUp />
        </Button>
      </form>
      {expanded && (
        <div className="animate-rise space-y-2 border-t px-3 py-2.5">
          <TaskDatePicker value={date} onChange={setDate} today={today} size="sm" />
          <TaskPriorityPicker value={priority} onChange={setPriority} size="sm" />
        </div>
      )}
    </div>
  )
}
