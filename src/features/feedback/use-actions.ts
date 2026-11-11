/**
 * Ações com feedback: conectam o store aos toasts. Componentes chamam estes
 * hooks em vez de acessar o store e montar mensagens por conta própria.
 */
import { useCallback } from 'react'
import { toast } from 'sonner'

import type { ISODate } from '@/domain/date'
import { buildDayOverview } from '@/domain/rules/day-overview'
import { indexLogs } from '@/domain/rules/habit-schedule'
import { isTaskDeleteLocked, TASK_DELETE_LOCKED_REASON } from '@/domain/rules/task-agenda'
import { useAppStore } from '@/store/app-store'
import { formatAmount } from '@/features/habits/habit-format'
import { formatNumber } from '@/lib/utils'
import { notifyFeedback, notifyProgression } from './notify'

/** Nota ao vivo de um dia aberto (para avisos); `null` se o dia já foi encerrado. */
function liveDay(date: ISODate): { score: number | null; v2: boolean; planned: number } | null {
  const s = useAppStore.getState()
  if (s.records[date]) return null
  const o = buildDayOverview({ date, habits: s.habits, logs: indexLogs(s.logs), tasks: s.tasks, record: null })
  return { score: o.breakdown.score, v2: o.breakdown.version === 'v2', planned: o.totalItems }
}

const fmtScore = (s: number | null) => (s === null ? '—' : formatNumber(s, 1))

/** Variação da nota até agora para o aviso (nota v2), com as notas já arredondadas como aparecem na tela. */
function scoreNote(before: ReturnType<typeof liveDay>, after: ReturnType<typeof liveDay>): string | undefined {
  if (!before || !after || !after.v2) return undefined
  if (before.score === null && after.score === null) return undefined
  return before.score === after.score ? `Nota até agora ${fmtScore(after.score)}` : `Nota até agora ${fmtScore(before.score)} → ${fmtScore(after.score)}`
}

/**
 * Executa uma mudança de planejamento (criar/editar tarefa) e, na nota v2,
 * avisa como o plano e a nota até agora mudaram — adicionar um item pendente
 * pode reduzir a nota, e o aviso explica isso na hora.
 */
export function withPlanFeedback<T>(date: ISODate, change: () => T): T {
  const before = liveDay(date)
  const result = change()
  const after = liveDay(date)
  if (before && after && after.v2 && (before.planned !== after.planned || before.score !== after.score)) {
    toast('Plano de hoje atualizado', {
      description: `${before.planned} → ${after.planned} ${after.planned === 1 ? 'item' : 'itens'} · nota até agora ${fmtScore(before.score)} → ${fmtScore(after.score)}`,
    })
  }
  return result
}

export function useHabitActions() {
  const toggleHabit = useAppStore((s) => s.toggleHabit)
  const setHabitValue = useAppStore((s) => s.setHabitValue)

  const toggle = useCallback(
    (habitId: string, date: ISODate) => {
      const store = useAppStore.getState()
      const habit = store.habits.find((h) => h.id === habitId)
      const before = store.logs.find((l) => l.habitId === habitId && l.date === date)
      const prevValue = before?.value ?? 0
      const dayBefore = liveDay(date)
      const fb = toggleHabit(habitId, date)
      if (!habit) return
      if (fb.xp > 0 || fb.events.includes('habit.session_completed')) {
        notifyFeedback(fb, {
          title: 'Hábito concluído',
          sub: habit.name,
          note: scoreNote(dayBefore, liveDay(date)),
          undo: () => setHabitValue(habitId, date, prevValue),
        })
      } else {
        notifyProgression(fb)
      }
    },
    [toggleHabit, setHabitValue],
  )

  const setValue = useCallback(
    (habitId: string, date: ISODate, value: number) => {
      const store = useAppStore.getState()
      const habit = store.habits.find((h) => h.id === habitId)
      const prevValue = store.logs.find((l) => l.habitId === habitId && l.date === date)?.value ?? 0
      const dayBefore = liveDay(date)
      const fb = setHabitValue(habitId, date, value)
      if (!habit) return
      const note = scoreNote(dayBefore, liveDay(date))
      if (fb.events.includes('habit.session_completed') || fb.events.includes('habit.weekly_goal_reached')) {
        notifyFeedback(fb, { title: 'Hábito concluído', sub: habit.name, note, undo: () => setHabitValue(habitId, date, prevValue) })
      } else if (value > prevValue && habit.target) {
        // Parcial: sem XP de sessão; o aviso mostra o Foco concedido e a nota até agora.
        notifyFeedback(fb, {
          title: 'Progresso registrado',
          sub: `${habit.name} · ${formatAmount(value, habit.target.unit)}`,
          note,
          undo: () => setHabitValue(habitId, date, prevValue),
        })
      } else notifyProgression(fb)
    },
    [setHabitValue],
  )

  const confirmLateHabit = useAppStore((s) => s.confirmLateHabit)

  /** Confirma (ou desfaz) um hábito de ontem já encerrado; a conclusão conta para ontem. */
  const confirmLate = useCallback(
    (habitId: string, date: ISODate, today: ISODate, done: boolean) => {
      const habit = useAppStore.getState().habits.find((h) => h.id === habitId)
      const fb = confirmLateHabit(habitId, date, today, done)
      if (!habit || !fb.record) return
      if (done) {
        notifyFeedback(fb, {
          title: 'Confirmado para ontem',
          sub: `${habit.name} · nota de ontem ${fb.record.score === null ? '—' : formatNumber(fb.record.score, 1)}`,
          undo: () => confirmLateHabit(habitId, date, today, false),
        })
      } else {
        toast('Confirmação desfeita', { description: habit.name })
      }
    },
    [confirmLateHabit],
  )

  return { toggle, setValue, confirmLate }
}

export function useTaskActions() {
  const setTaskCompleted = useAppStore((s) => s.setTaskCompleted)
  const deleteTask = useAppStore((s) => s.deleteTask)
  const restoreTask = useAppStore((s) => s.restoreTask)

  const toggle = useCallback(
    (taskId: string, today: ISODate) => {
      const task = useAppStore.getState().tasks.find((t) => t.id === taskId)
      if (!task) return
      const dayBefore = liveDay(today)
      const fb = setTaskCompleted(taskId, !task.completed, today)
      if (!task.completed) {
        notifyFeedback(fb, {
          title: 'Tarefa concluída',
          sub: task.title,
          note: scoreNote(dayBefore, liveDay(today)),
          undo: () => setTaskCompleted(taskId, false, today),
        })
      }
    },
    [setTaskCompleted],
  )

  const remove = useCallback(
    (taskId: string) => {
      const { tasks, records } = useAppStore.getState()
      const task = tasks.find((t) => t.id === taskId)
      if (task && isTaskDeleteLocked(task, records)) {
        toast('Não é possível excluir', { description: TASK_DELETE_LOCKED_REASON })
        return
      }
      const removed = deleteTask(taskId)
      if (!removed) return
      toast('Tarefa excluída', {
        description: removed.task.title,
        action: { label: 'Desfazer', onClick: () => restoreTask(removed.task, removed.entries) },
      })
    },
    [deleteTask, restoreTask],
  )

  return { toggle, remove }
}

export function useSkillActions() {
  const logSkillPractice = useAppStore((s) => s.logSkillPractice)
  const removeSkillPractice = useAppStore((s) => s.removeSkillPractice)
  const setHabitValue = useAppStore((s) => s.setHabitValue)

  const practice = useCallback(
    (skillId: string, duration: number | null, date: ISODate) => {
      const store = useAppStore.getState()
      const skill = store.skills.find((s) => s.id === skillId)
      if (!skill) return
      const before = store.skillPractices.map((p) => p.id)
      const prevLogs = new Map(store.logs.map((l) => [`${l.habitId}|${l.date}`, l.value]))
      const fb = logSkillPractice(skillId, { duration }, date)
      const after = useAppStore.getState()
      const added = after.skillPractices.find((p) => !before.includes(p.id) && p.skillId === skillId && !p.sourceLogId)
      const changedLog = after.logs.find((l) => l.date === date && prevLogs.get(`${l.habitId}|${l.date}`) !== l.value)
      const undo = () => {
        if (fb.via === 'habit' && changedLog) setHabitValue(changedLog.habitId, date, prevLogs.get(`${changedLog.habitId}|${date}`) ?? 0)
        if (added) removeSkillPractice(added.id, date)
      }
      notifyFeedback(fb, {
        title: 'Prática registrada',
        sub: `${skill.name}${duration ? ` · ${duration} min` : ''}`,
        undo,
      })
    },
    [logSkillPractice, removeSkillPractice, setHabitValue],
  )

  return { practice }
}
