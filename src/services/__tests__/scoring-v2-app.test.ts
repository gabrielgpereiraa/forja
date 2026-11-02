/**
 * Nota v2 no app: ativação por data (com início do dia e trava de prévia),
 * encerramento, confirmação tardia, reversão, persistência e recompensas.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { addDays, getProductivityDate, type ISODate } from '@/domain/date'
import { sumResource } from '@/domain/gamification/engine'
import type { HabitInput } from '@/domain/models/habit'
import { buildDayOverview } from '@/domain/rules/day-overview'
import { getHabitsForDay, indexLogs } from '@/domain/rules/habit-schedule'
import { rescoreFromSnapshot } from '@/domain/rules/late-confirmation'
import { weeklyRhythm } from '@/domain/rules/weekly-rhythm'
import {
  configureScoringActivation,
  isV2Day,
  resolveScoringActivation,
  SCORING_V2_OFF,
  scoringV1,
  scoringV2,
  strategyForDay,
} from '@/domain/scoring'
import { createEmptyData, migrateData, SCHEMA_VERSION, type AppData } from '../app-data'
import * as cmd from '../commands'

// 2026-10-05 é segunda-feira.
const START = '2026-10-05' as ISODate
const D = '2026-10-06' as ISODate
const NEXT = '2026-10-07' as ISODate
const SLEEP: HabitInput = { name: 'Dormir até 23h', category: 'health', icon: 'bed', color: 'indigo', schedule: { weeklyGoal: 7, days: null }, target: null, confirmNextDay: true }
const READ: HabitInput = { name: 'Ler', category: 'study', icon: 'book', color: 'amber', schedule: { weeklyGoal: 7, days: null }, target: null }
const SCREENS: HabitInput = { ...SLEEP, name: 'Sem telas após 22h', icon: 'moon' }

const activate = (from: ISODate | null, until: ISODate | null = null) => configureScoringActivation({ v2From: from, v2Until: until })
afterEach(() => configureScoringActivation(SCORING_V2_OFF))

/** Dia D: lê, sono (flag) em aberto, uma tarefa normal pendente; encerrado à noite (janela da manhã aberta). */
function closedAtNight(extraFlag = false) {
  let data: AppData = cmd.completeOnboarding(createEmptyData(), 'Nino', START)
  const sleep = cmd.createHabit(data, SLEEP, START)
  data = sleep.data
  let screensId: string | null = null
  if (extraFlag) {
    const s = cmd.createHabit(data, SCREENS, START)
    data = s.data
    screensId = s.habit.id
  }
  const read = cmd.createHabit(data, READ, START)
  const task = cmd.createTask(read.data, { title: 'Relatório', dueDate: D, priority: 'normal' }, START)
  data = cmd.toggleHabit(task.data, read.habit.id, D).data
  data = cmd.closeDay(data, D, 'user', D).data
  return { data, sleepId: sleep.habit.id, screensId, readId: read.habit.id, taskId: task.task.id }
}
const dayXp = (d: AppData, date: ISODate) => sumResource(d.ledger.filter((e) => e.sourceKey === `day:${date}`), 'xp')

describe('ativação da v2', () => {
  it('lê a configuração do build com a trava de prévia', () => {
    expect(resolveScoringActivation({ cloud: true, vercelEnv: 'production' })).toEqual({ v2From: null, v2Until: null, blocked: null })
    expect(resolveScoringActivation({ from: '2026-13-40', cloud: false }).blocked).toBe('data inválida')
    expect(resolveScoringActivation({ from: '2026-11-10', cloud: true, vercelEnv: 'preview' })).toMatchObject({ v2From: null, blocked: expect.any(String) })
    expect(resolveScoringActivation({ from: '2026-11-10', cloud: true, vercelEnv: '' })).toMatchObject({ v2From: null })
    expect(resolveScoringActivation({ from: '2026-11-10', cloud: true, vercelEnv: 'production' })).toEqual({ v2From: '2026-11-10', v2Until: null, blocked: null })
    expect(resolveScoringActivation({ from: '2026-11-10', until: '2026-11-20', cloud: false, vercelEnv: 'preview' })).toEqual({
      v2From: '2026-11-10',
      v2Until: '2026-11-20',
      blocked: null,
    })
  })

  it('a data é inclusiva; a reversão (until) é exclusiva', () => {
    const a = { v2From: '2026-11-10' as ISODate, v2Until: '2026-11-20' as ISODate }
    expect(strategyForDay('2026-11-09', a)).toBe(scoringV1)
    expect(strategyForDay('2026-11-10', a)).toBe(scoringV2)
    expect(strategyForDay('2026-11-19', a)).toBe(scoringV2)
    expect(strategyForDay('2026-11-20', a)).toBe(scoringV1)
    expect(strategyForDay('2026-11-10', SCORING_V2_OFF)).toBe(scoringV1)
  })

  it('respeita o início do dia configurado: a virada acontece nesse horário, não à meia-noite', () => {
    const a = { v2From: '2026-11-10' as ISODate, v2Until: null }
    const at = (h: number, m = 0) => new Date(2026, 10, 10, h, m)
    expect(isV2Day(getProductivityDate(at(0, 30), 4), a)).toBe(false) // ainda é o dia 09 do app
    expect(isV2Day(getProductivityDate(at(3, 59), 4), a)).toBe(false)
    expect(isV2Day(getProductivityDate(at(4, 0), 4), a)).toBe(true)
    expect(isV2Day(getProductivityDate(at(5, 0), 6), a)).toBe(false) // início do dia às 06:00
    expect(isV2Day(getProductivityDate(at(6, 0), 6), a)).toBe(true)
  })
})

describe('dias do app com a v2', () => {
  it('sem a variável, tudo segue exatamente na v1', () => {
    const { data } = closedAtNight()
    const o = buildDayOverview({ date: NEXT, habits: data.habits, logs: indexLogs(data.logs), tasks: data.tasks, record: null })
    expect(o.breakdown.version).toBe('v1')
    expect(data.records[D]?.breakdown.version).toBe('v1')
    expect(data.records[D]?.breakdown.items).toBeUndefined()
  })

  it('um dia anterior à data fica na v1 (nota ao vivo, revisão da manhã, encerramento); a partir dela, v2', () => {
    activate(NEXT)
    let data: AppData = cmd.completeOnboarding(createEmptyData(), 'Nino', START)
    const read = cmd.createHabit(data, READ, START)
    data = cmd.toggleHabit(read.data, read.habit.id, D).data
    const live = (date: ISODate) => buildDayOverview({ date, habits: data.habits, logs: indexLogs(data.logs), tasks: data.tasks, record: null }).breakdown
    expect(live(D).version).toBe('v1') // ontem aberto na revisão da manhã do dia da virada
    expect(live(NEXT).version).toBe('v2')
    data = cmd.closeDay(data, D, 'user', NEXT).data
    expect(data.records[D]?.breakdown.version).toBe('v1')
    data = cmd.toggleHabit(data, read.habit.id, NEXT).data
    data = cmd.closeDay(data, NEXT, 'user', NEXT).data
    const rec = data.records[NEXT]!
    expect(rec.breakdown.version).toBe('v2')
    expect(rec.breakdown.items?.[0]).toMatchObject({ kind: 'habit', id: read.habit.id, role: 'required', progress: 1 })
    expect(rec.scoringSnapshot?.habits.map((h) => h.habitId)).toEqual([read.habit.id])
  })

  it('o XP do dia v2 continua nota × 10 (mais ritual e bônus de encerramento)', () => {
    activate(D)
    const { data } = closedAtNight()
    const rec = data.records[D]!
    expect(rec.breakdown.version).toBe('v2')
    const scoreEntry = data.ledger.find((e) => e.sourceKey === `day:${D}` && e.ruleId === 'day.closed.score')
    expect(scoreEntry?.amount).toBe(Math.round(rec.score! * 10))
  })
})

describe('confirmação tardia e histórico', () => {
  it('dia v1 encerrado antes da ativação: confirmado depois, recalcula com a v1 (2,8 → 5,8; desfazer volta a 2,8)', () => {
    const { data, sleepId } = closedAtNight() // D encerrado em v1
    activate(NEXT) // a v2 vale a partir de hoje
    expect(data.records[D]?.score).toBe(2.8)
    const confirmed = cmd.confirmLateHabit(data, sleepId, D, NEXT, true).data
    expect(confirmed.records[D]?.breakdown.version).toBe('v1')
    expect(confirmed.records[D]?.score).toBe(5.8)
    // A v2 daria 7,0 para o mesmo retrato, mas não é usada.
    expect(rescoreFromSnapshot(data.records[D]!.scoringSnapshot!, D, new Set([sleepId]), scoringV2).score).toBe(7)
    const undone = cmd.confirmLateHabit(confirmed, sleepId, D, NEXT, false).data
    expect(undone.records[D]).toEqual(data.records[D])
    expect(dayXp(undone, D)).toBe(dayXp(data, D))
  })

  it('dia v2: várias confirmações e desfazer preservam retrato e versão', () => {
    activate(D)
    const { data, sleepId, screensId } = closedAtNight(true)
    const original = data.records[D]!
    expect(original.breakdown.version).toBe('v2')
    const both = cmd.confirmLateHabit(cmd.confirmLateHabit(data, sleepId, D, NEXT, true).data, screensId!, D, NEXT, true).data
    expect(both.records[D]?.breakdown.version).toBe('v2')
    expect(both.records[D]?.scoringSnapshot).toEqual(original.scoringSnapshot)
    expect(both.records[D]!.score!).toBeGreaterThan(original.score!)
    const one = cmd.confirmLateHabit(both, sleepId, D, NEXT, false).data
    const onlyScreens = cmd.confirmLateHabit(data, screensId!, D, NEXT, true).data
    expect(one.records[D]?.score).toBe(onlyScreens.records[D]?.score)
    expect(one.records[D]?.breakdown).toEqual(onlyScreens.records[D]?.breakdown)
    const none = cmd.confirmLateHabit(one, screensId!, D, NEXT, false).data
    expect(none.records[D]).toEqual(original)
  })

  it('remarcar tarefa depois do encerramento não muda um dia v2', () => {
    activate(D)
    const { data, sleepId, taskId } = closedAtNight()
    const reference = cmd.confirmLateHabit(data, sleepId, D, NEXT, true).data
    const moved = cmd.updateTask(data, taskId, { title: 'Relatório', dueDate: addDays(NEXT, 1), priority: 'high' })
    expect(cmd.confirmLateHabit(moved, sleepId, D, NEXT, true).data.records[D]?.breakdown).toEqual(reference.records[D]?.breakdown)
  })
})

describe('reversão', () => {
  it('desligar a v2 não torna registros v2 ilegíveis nem recalcula dias anteriores', () => {
    activate(D)
    const { data, sleepId } = closedAtNight()
    const v2Record = data.records[D]!
    configureScoringActivation(SCORING_V2_OFF) // reversão: variável removida
    const o = buildDayOverview({ date: D, habits: data.habits, logs: indexLogs(data.logs), tasks: data.tasks, record: v2Record })
    expect(o.breakdown).toBe(v2Record.breakdown) // exibe o detalhamento gravado
    const confirmed = cmd.confirmLateHabit(data, sleepId, D, NEXT, true).data
    expect(confirmed.records[D]?.breakdown.version).toBe('v2') // recalcula pela versão gravada
    expect(cmd.confirmLateHabit(confirmed, sleepId, D, NEXT, false).data.records[D]).toEqual(v2Record)
  })

  it('reversão a partir de um dia futuro (until): dias da janela seguem v2, os seguintes voltam à v1', () => {
    activate(D, NEXT)
    let data: AppData = cmd.completeOnboarding(createEmptyData(), 'Nino', START)
    const read = cmd.createHabit(data, READ, START)
    data = cmd.toggleHabit(read.data, read.habit.id, D).data
    data = cmd.closeDay(data, D, 'user', D).data
    data = cmd.toggleHabit(data, read.habit.id, NEXT).data
    data = cmd.closeDay(data, NEXT, 'user', NEXT).data
    expect(data.records[D]?.breakdown.version).toBe('v2')
    expect(data.records[NEXT]?.breakdown.version).toBe('v1')
  })
})

describe('persistência e recompensas', () => {
  it('backup e sincronização (JSON) preservam o detalhamento v2 e os itens', () => {
    activate(D)
    const { data } = closedAtNight()
    const imported = migrateData(JSON.parse(JSON.stringify({ data })).data as AppData, SCHEMA_VERSION)
    expect(imported.records[D]).toEqual(data.records[D])
    expect(imported.records[D]?.breakdown.items?.length).toBeGreaterThan(0)
    expect(imported.records[D]?.breakdown.taskCap).toEqual(data.records[D]?.breakdown.taskCap)
  })

  it('avisos refletem o concedido: parcial dá Foco sem XP; sessão concluída +20 XP; tarefa conforme a prioridade', () => {
    let data: AppData = cmd.completeOnboarding(createEmptyData(), 'Nino', START)
    const study = cmd.createHabit(data, { ...READ, name: 'Estudar', target: { amount: 30, unit: 'minutes' } }, START)
    data = study.data
    const partial = cmd.setHabitValue(data, study.habit.id, D, 10, D)
    expect(partial.feedback.xp).toBe(0)
    expect(partial.feedback.focus).toBe(10)
    const full = cmd.setHabitValue(partial.data, study.habit.id, D, 30, D)
    expect(full.feedback.xp).toBe(20)
    expect(full.feedback.focus).toBe(20)
    data = full.data
    for (const [priority, xp] of [['low', 5], ['normal', 10], ['high', 20]] as const) {
      const t = cmd.createTask(data, { title: priority, dueDate: D, priority }, D)
      const r = cmd.setTaskCompleted(t.data, t.task.id, true, D, D)
      expect(r.feedback.xp).toBe(xp)
      data = r.data
    }
  })
})

describe('ritmo da semana', () => {
  it('soma o parcial de hoje uma vez e não conta duas vezes a sessão concluída', () => {
    let data: AppData = cmd.completeOnboarding(createEmptyData(), 'Nino', START)
    const study = cmd.createHabit(data, { ...READ, name: 'Estudar', schedule: { weeklyGoal: 5, days: null }, target: { amount: 30, unit: 'minutes' } }, START)
    data = cmd.setHabitValue(study.data, study.habit.id, START, 30).data // segunda concluída
    data = cmd.setHabitValue(data, study.habit.id, D, 12).data // terça (hoje): parcial 12/30
    const state = getHabitsForDay(data.habits, D, indexLogs(data.logs))[0]!
    const r = weeklyRhythm([state])
    expect(r.habits[0]!.partialToday).toBeCloseTo(0.4, 9)
    expect(r.ratio).toBeCloseTo(Math.min(1, (1 + 0.4) / state.week.expectedByToday), 9)
    data = cmd.setHabitValue(data, study.habit.id, D, 30).data // hoje concluída
    const done = weeklyRhythm(getHabitsForDay(data.habits, D, indexLogs(data.logs)))
    expect(done.habits[0]).toMatchObject({ done: 2, partialToday: 0 })
    // Parciais de dias anteriores não contam.
    data = cmd.setHabitValue(cmd.setHabitValue(data, study.habit.id, START, 10).data, study.habit.id, D, 0).data
    expect(weeklyRhythm(getHabitsForDay(data.habits, D, indexLogs(data.logs))).habits[0]).toMatchObject({ done: 0, partialToday: 0 })
  })

  it('a nota v2 não depende do ritmo (histórico da semana)', () => {
    activate(D)
    const { data } = closedAtNight()
    expect(data.records[D]!.breakdown.components.some((c) => c.id === 'rhythm')).toBe(false)
  })
})
