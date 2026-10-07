/**
 * Hooks de leitura: selecionam fatias cruas do store e derivam visões de
 * domínio com memoização. As páginas consomem apenas estes hooks.
 */
import { useMemo } from 'react'

import { addDays, startOfWeek, type ISODate } from '@/domain/date'
import { ACHIEVEMENTS, isAchievementUnlocked } from '@/domain/gamification/achievements'
import { attributeXp, balances } from '@/domain/gamification/engine'
import { getLevelInfo } from '@/domain/gamification/levels'
import { buildDayOverview } from '@/domain/rules/day-overview'
import { suggestAll } from '@/domain/rules/habit-progression'
import { lateConfirmationCandidates } from '@/domain/rules/late-confirmation'
import { getHabitsForDay, habitWeekStreak, indexLogs } from '@/domain/rules/habit-schedule'
import { computePlayerStats } from '@/domain/rules/stats'
import { computeStreak } from '@/domain/rules/streaks'
import { buildWeekOverview } from '@/domain/rules/week-overview'
import { replaySkill, type SkillSnapshot } from '@/domain/skills/engine'
import type { HabitSkillContribution, Skill } from '@/domain/models/skill'
import { useAppStore } from '@/store/app-store'

export function useLogIndex() {
  const logs = useAppStore((s) => s.logs)
  return useMemo(() => indexLogs(logs), [logs])
}

export function useDayOverview(date: ISODate) {
  const habits = useAppStore((s) => s.habits)
  const tasks = useAppStore((s) => s.tasks)
  const record = useAppStore((s) => s.records[date] ?? null)
  const logs = useLogIndex()
  return useMemo(() => buildDayOverview({ date, habits, logs, tasks, record }), [date, habits, logs, tasks, record])
}

export function useWeekOverview(weekStart: ISODate, today: ISODate) {
  const habits = useAppStore((s) => s.habits)
  const tasks = useAppStore((s) => s.tasks)
  const records = useAppStore((s) => s.records)
  const logs = useLogIndex()
  return useMemo(
    () => buildWeekOverview({ weekStart, today, habits, logs, tasks, records }),
    [weekStart, today, habits, logs, tasks, records],
  )
}

export function useStreak(today: ISODate) {
  const records = useAppStore((s) => s.records)
  return useMemo(() => computeStreak(records, today), [records, today])
}

/** Estados de todos os hábitos ativos para uma data + sequência semanal. */
export function useHabitStates(date: ISODate) {
  const habits = useAppStore((s) => s.habits)
  const logs = useLogIndex()
  return useMemo(
    () => getHabitsForDay(habits, date, logs).map((state) => ({ state, weekStreak: habitWeekStreak(state.habit, date, logs) })),
    [habits, date, logs],
  )
}

export function usePlayer(today: ISODate) {
  const ledger = useAppStore((s) => s.ledger)
  const habits = useAppStore((s) => s.habits)
  const logs = useAppStore((s) => s.logs)
  const tasks = useAppStore((s) => s.tasks)
  const records = useAppStore((s) => s.records)
  const unlocked = useAppStore((s) => s.achievements)
  const logIndex = useLogIndex()

  return useMemo(() => {
    const bal = balances(ledger)
    const level = getLevelInfo(bal.xp ?? 0)
    const stats = computePlayerStats({ today, habits, logs, logIndex, tasks, records, ledger })
    const xpToday = ledger.filter((e) => e.resource === 'xp' && e.date === today).reduce((s, e) => s + e.amount, 0)
    const achievements = ACHIEVEMENTS.map((def) => ({
      def,
      progress: def.progress(stats),
      unlocked: unlocked[def.id] ?? (isAchievementUnlocked(def, stats) ? { id: def.id, unlockedAt: '', date: today } : null),
    }))
    return { balances: bal, level, stats, attributes: attributeXp(ledger), xpToday, achievements }
  }, [ledger, habits, logs, logIndex, tasks, records, unlocked, today])
}

export function useCurrentWeekStart(today: ISODate) {
  return useMemo(() => startOfWeek(today), [today])
}

/**
 * Visão de ontem quando ele ainda aguarda a revisão da manhã (não encerrado,
 * com algo planejado). `null` quando não há revisão pendente.
 */
export function usePendingReview(today: ISODate) {
  const yesterday = addDays(today, -1)
  const startDate = useAppStore((s) => s.profile.startDate)
  const overview = useDayOverview(yesterday)
  if (!startDate || yesterday < startDate || overview.record || overview.phase === 'empty') return null
  return overview
}

/**
 * Ontem já encerrado com hábitos "Confirmar na manhã seguinte" que ainda podem
 * ser confirmados (ou desfeitos). `null` fora da janela ou sem candidatos.
 */
export function useLateConfirmation(today: ISODate) {
  const date = addDays(today, -1)
  const habits = useAppStore((s) => s.habits)
  const record = useAppStore((s) => s.records[date] ?? null)
  const logs = useLogIndex()
  return useMemo(() => {
    const { pending, confirmed } = lateConfirmationCandidates(record, habits, logs, today)
    if (!record || pending.length + confirmed.length === 0) return null
    const ids = new Set([...pending, ...confirmed])
    const states = getHabitsForDay(habits, date, logs).filter((s) => ids.has(s.habit.id))
    return { date, record, states, pending: new Set(pending), confirmed: new Set(confirmed) }
  }, [record, habits, logs, today, date])
}

/** Pode confirmar/desfazer este hábito de `date` agora? (dia encerrado, janela aberta) */
export function useLateConfirmable(habitId: string | null, date: ISODate | null, today: ISODate) {
  const habits = useAppStore((s) => s.habits)
  const record = useAppStore((s) => (date ? s.records[date] ?? null : null))
  const logs = useLogIndex()
  return useMemo(() => {
    if (!habitId || !record) return null
    const { pending, confirmed } = lateConfirmationCandidates(record, habits, logs, today)
    if (pending.includes(habitId)) return 'confirm' as const
    if (confirmed.includes(habitId)) return 'undo' as const
    return null
  }, [habitId, record, habits, logs, today])
}

/** Sugestões de progressão de meta para os hábitos ativos. */
export function useProgressionSuggestions(today: ISODate) {
  const habits = useAppStore((s) => s.habits)
  const logs = useLogIndex()
  return useMemo(() => suggestAll(habits, today, logs), [habits, today, logs])
}

export interface SkillView {
  skill: Skill
  snapshot: SkillSnapshot
  links: HabitSkillContribution[]
}

/** Projeção de todas as habilidades em `today` (recalculada só quando os dados mudam). */
export function useSkillViews(today: ISODate): SkillView[] {
  const skills = useAppStore((s) => s.skills)
  const practices = useAppStore((s) => s.skillPractices)
  const links = useAppStore((s) => s.skillLinks)
  return useMemo(
    () =>
      [...skills]
        .sort((a, b) => a.order - b.order)
        .map((skill) => ({ skill, snapshot: replaySkill(skill, practices, today), links: links.filter((l) => l.skillId === skill.id) })),
    [skills, practices, links, today],
  )
}
