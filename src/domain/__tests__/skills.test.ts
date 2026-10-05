import { describe, expect, it } from 'vitest'
import { addDays, type ISODate } from '../date'
import type { Skill, SkillPractice } from '../models/skill'
import { SKILL_CONFIG } from '../skills/config'
import {
  calculateLevel,
  calculateMasteryGain,
  calculateRecovery,
  calculateSkillDecay,
  calculateSkillState,
  replaySkill,
  xpForLevel,
} from '../skills/engine'

const START = '2026-01-05' as const // segunda

function skill(partial: Partial<Skill> = {}): Skill {
  return {
    id: 'sk',
    name: 'Guitarra',
    category: 'creative',
    icon: 'guitar',
    color: 'violet',
    maintenancePerWeek: 2,
    sessionMinutes: 30,
    archived: false,
    startDate: START,
    createdAt: '2026-01-05T10:00:00.000Z',
    updatedAt: '2026-01-05T10:00:00.000Z',
    order: 1,
    ...partial,
  }
}

let n = 0
function practice(date: ISODate, duration: number | null = 30, extra: Partial<SkillPractice> = {}): SkillPractice {
  n++
  return { id: `p${n}`, skillId: 'sk', date, duration, value: null, unit: null, intensity: 1, weight: 1, sourceHabitId: null, sourceLogId: null, createdAt: '', ...extra }
}

/** Práticas nos dias da semana (0 = seg) indicados, por `weeks` semanas a partir de `from`. */
function schedule(from: ISODate, weeks: number, weekdays: number[], duration = 30): SkillPractice[] {
  const out: SkillPractice[] = []
  for (let w = 0; w < weeks; w++) for (const wd of weekdays) out.push(practice(addDays(from, w * 7 + wd), duration))
  return out
}

/** Skill com histórico "maduro" para testes de decay/recuperação. */
function trained(weeks: number, perWeek: number[] = [0, 2, 4]) {
  return schedule(START, weeks, perWeek)
}

describe('evolução', () => {
  it('prática dentro da meta sobe condição e XP', () => {
    const s = replaySkill(skill(), schedule(START, 2, [0, 3]), addDays(START, 13))
    expect(s.condition).toBeGreaterThan(SKILL_CONFIG.INITIAL_CONDITION)
    expect(s.experience).toBeGreaterThan(0)
    expect(s.status).toBe('maintaining')
  })

  it('prática acima da meta → evoluindo e mais progresso que só manter', () => {
    const asOf = addDays(START, 27)
    const maintain = replaySkill(skill(), schedule(START, 4, [0, 3]), asOf)
    const above = replaySkill(skill(), schedule(START, 4, [0, 2, 4]), asOf)
    expect(addDays(START, 25) <= asOf).toBe(true)
    expect(replaySkill(skill(), schedule(START, 4, [0, 2, 4]), addDays(START, 25)).status).toBe('evolving')
    expect(above.experience).toBeGreaterThan(maintain.experience)
    expect(above.condition).toBeGreaterThanOrEqual(maintain.condition)
  })

  it('várias sessões: experiência acumula e nível sobe devagar', () => {
    const s = replaySkill(skill(), trained(12), addDays(START, 83))
    expect(s.level).toBeGreaterThan(3)
    expect(s.level).toBeLessThan(10) // longo prazo: não é level-up a cada sessão
    expect(s.levelInfo.progress).toBeGreaterThanOrEqual(0)
    expect(s.levelInfo.progress).toBeLessThan(1)
  })

  it('curva de nível é crescente e convexa', () => {
    const steps = [2, 3, 4, 5, 6].map((l) => xpForLevel(l + 1) - xpForLevel(l))
    expect(steps.every((v, i) => i === 0 || v > steps[i - 1]!)).toBe(true)
    expect(calculateLevel(xpForLevel(5)).level).toBe(5)
  })

  it('duração conta: 60 min rende mais que 15 min', () => {
    const long = replaySkill(skill(), [practice(START, 60)], START)
    const short = replaySkill(skill(), [practice(START, 15)], START)
    expect(long.experience).toBeGreaterThan(short.experience)
    expect(long.totalMinutes).toBe(60)
  })
})

describe('manutenção', () => {
  it('praticando exatamente na frequência: nenhuma ferrugem', () => {
    const s = replaySkill(skill(), schedule(START, 8, [0, 3]), addDays(START, 55))
    expect(s.history.every((d) => d.decay === 0)).toBe(true)
  })

  it('habilidade estável: depois da 1ª semana, condição não cai entre sessões', () => {
    const s = replaySkill(skill(), schedule(START, 6, [1, 5]), addDays(START, 41))
    const steady = s.history.slice(7) // a partir de quando a janela de 7 dias já tem 2 sessões
    for (let i = 1; i < steady.length; i++) expect(steady[i]!.condition).toBeGreaterThanOrEqual(steady[i - 1]!.condition)
  })

  it('estado: 3/2 evoluindo, 2/2 mantendo, 0/2 fora da tolerância enferrujando', () => {
    const base = { lastPracticedOn: '2026-01-05' as ISODate, maintenancePerWeek: 2 }
    expect(calculateSkillState({ ...base, asOf: '2026-01-06', sessionsInWindow: 3 }).status).toBe('evolving')
    expect(calculateSkillState({ ...base, asOf: '2026-01-06', sessionsInWindow: 2 }).status).toBe('maintaining')
    expect(calculateSkillState({ ...base, asOf: '2026-01-06', sessionsInWindow: 1 })).toMatchObject({ status: 'maintaining', daysUntilRust: 2 })
    expect(calculateSkillState({ ...base, asOf: '2026-01-12', sessionsInWindow: 0 }).status).toBe('rusting')
    expect(calculateSkillState({ lastPracticedOn: null, asOf: '2026-01-12', sessionsInWindow: 0, maintenancePerWeek: 2 }).status).toBe('new')
  })
})

describe('decay', () => {
  const base = { condition: 80, mastery: 30, level: 5, maintenancePerWeek: 2, minimumCondition: 20, sessionsInWindow: 0 }

  it('período de tolerância: 0–2 dias sem ferrugem', () => {
    for (const d of [0, 1, 2]) expect(calculateSkillDecay({ ...base, daysSinceLast: d }).amount).toBe(0)
    expect(calculateSkillDecay({ ...base, daysSinceLast: 3 }).amount).toBeGreaterThan(0)
  })

  it('fases: leve < moderada < maior; depois de 60 dias desacelera', () => {
    const at = (d: number) => calculateSkillDecay({ ...base, daysSinceLast: d }).amount
    expect(at(5)).toBeLessThan(at(10))
    expect(at(10)).toBeLessThan(at(30))
    expect(at(70)).toBeLessThan(at(30))
  })

  it('poucos dias sem praticar: enquanto a janela de 7 dias cobre a manutenção, nada; depois, perda pequena', () => {
    const p = trained(10)
    const last = p[p.length - 1]!.date // sexta; quarta e sexta ainda contam na janela
    const before = replaySkill(skill(), p, last).condition
    expect(replaySkill(skill(), p, addDays(last, 5)).condition).toBe(before)
    const after = replaySkill(skill(), p, addDays(last, 8)).condition
    expect(before - after).toBeGreaterThan(0)
    expect(before - after).toBeLessThan(4)
  })

  it('inatividade moderada e longa: perda crescente, sem passar do piso', () => {
    const p = trained(10)
    const last = p[p.length - 1]!.date
    const c = (days: number) => replaySkill(skill(), p, addDays(last, days)).condition
    expect(c(15)).toBeLessThan(c(5))
    expect(c(45)).toBeLessThan(c(15))
    expect(c(400)).toBeGreaterThanOrEqual(SKILL_CONFIG.MINIMUM_CONDITION)
    expect(c(400)).toBeCloseTo(SKILL_CONFIG.MINIMUM_CONDITION, 0)
  })

  it('piso: nunca abaixo do mínimo (padrão ou por habilidade)', () => {
    expect(calculateSkillDecay({ ...base, condition: 20.5, daysSinceLast: 30 }).amount).toBeLessThanOrEqual(0.5)
    const p = trained(4)
    const s = replaySkill(skill({ minimumCondition: 35 }), p, addDays(START, 700))
    expect(s.condition).toBeGreaterThanOrEqual(35)
  })

  it('nível e maestria não caem com a ferrugem', () => {
    const p = trained(20)
    const last = p[p.length - 1]!.date
    const a = replaySkill(skill(), p, last)
    const b = replaySkill(skill(), p, addDays(last, 120))
    expect(b.level).toBe(a.level)
    expect(b.mastery).toBe(a.mastery)
    expect(b.experience).toBe(a.experience)
  })

  it('manutenção mais exigente enferruja mais rápido', () => {
    const lo = calculateSkillDecay({ ...base, maintenancePerWeek: 2, daysSinceLast: 10 }).amount
    const hi = calculateSkillDecay({ ...base, maintenancePerWeek: 5, daysSinceLast: 10 }).amount
    expect(hi).toBeGreaterThan(lo)
  })

  it('não enferruja hoje antes do dia acabar', () => {
    const p = trained(4)
    const last = p[p.length - 1]!.date
    const s = replaySkill(skill(), p, addDays(last, 10))
    expect(s.history[s.history.length - 1]!.decay).toBe(0)
  })
})

describe('maestria', () => {
  it('maestria alta enferruja menos no mesmo período', () => {
    const low = calculateSkillDecay({ condition: 80, mastery: 20, level: 5, maintenancePerWeek: 2, minimumCondition: 20, sessionsInWindow: 0, daysSinceLast: 15 }).amount
    const high = calculateSkillDecay({ condition: 80, mastery: 90, level: 5, maintenancePerWeek: 2, minimumCondition: 20, sessionsInWindow: 0, daysSinceLast: 15 }).amount
    expect(high).toBeLessThan(low * 0.5)
  })

  it('30 dias parado: usuário com mais maestria perde menos (replay)', () => {
    const veteran = trained(60) // ~1 ano e pouco de prática consistente
    const novice = trained(8)
    const vLast = veteran[veteran.length - 1]!.date
    const nLast = novice[novice.length - 1]!.date
    const v0 = replaySkill(skill(), veteran, vLast)
    const n0 = replaySkill(skill(), novice, nLast)
    expect(v0.mastery).toBeGreaterThan(n0.mastery + 30)
    const vLoss = v0.condition - replaySkill(skill(), veteran, addDays(vLast, 30)).condition
    const nLoss = n0.condition - replaySkill(skill(), novice, addDays(nLast, 30)).condition
    expect(vLoss).toBeLessThan(nLoss)
  })

  it('só consolida com condição alta e prática consistente, com retornos decrescentes', () => {
    const g = (m: number, c = 90, s = 2) => calculateMasteryGain({ mastery: m, condition: c, effort: 1, sessionsInWindow: s, maintenancePerWeek: 2 })
    expect(g(10, 60)).toBe(0)
    expect(g(10, 90, 1)).toBe(0)
    expect(g(80)).toBeLessThan(g(10))
  })
})

describe('recuperação', () => {
  it('habilidade enferrujada recupera com novas sessões', () => {
    const p = trained(20)
    const last = p[p.length - 1]!.date
    const rustyDay = addDays(last, 40)
    const rusty = replaySkill(skill(), p, rustyDay)
    expect(rusty.status).toBe('rusting')
    const back = [...p, ...schedule(addDays(rustyDay, 1), 2, [0, 2, 4])]
    const after = replaySkill(skill(), back, addDays(rustyDay, 14))
    expect(after.condition).toBeGreaterThan(rusty.condition + 10)
  })

  it('recuperação proporcional ao esforço', () => {
    expect(calculateRecovery({ condition: 50, mastery: 50, effort: 2 })).toBeCloseTo(2 * calculateRecovery({ condition: 50, mastery: 50, effort: 1 }))
  })

  it('maestria acelera a recuperação ("memória muscular")', () => {
    const novice = calculateRecovery({ condition: 60, mastery: 0, effort: 1 })
    const master = calculateRecovery({ condition: 60, mastery: 80, effort: 1 })
    expect(master).toBeGreaterThan(novice * 1.5)
    // Exemplo do produto: 61% com maestria 78 → ~+5/6 por sessão.
    expect(calculateRecovery({ condition: 61, mastery: 78, effort: 1 })).toBeGreaterThan(4.5)
  })

  it('perto do máximo o ganho diminui e nunca passa de 100', () => {
    expect(calculateRecovery({ condition: 97, mastery: 90, effort: 2 })).toBeLessThanOrEqual(3)
    const s = replaySkill(skill(), trained(30, [0, 1, 2, 3, 4, 5, 6]), addDays(START, 209))
    expect(s.condition).toBeLessThanOrEqual(100)
  })
})

describe('consistência', () => {
  it('determinístico: mesmos dados, mesmo resultado; ordem das práticas não importa', () => {
    const p = trained(10)
    const asOf = addDays(START, 90)
    const a = replaySkill(skill(), p, asOf)
    const b = replaySkill(skill(), [...p].reverse(), asOf)
    expect(b).toEqual(a)
  })

  it('não depende de abrir o app: calcular direto em 20/10 = calcular dia a dia', () => {
    const p = [practice('2026-10-01')]
    const sk = skill({ startDate: '2026-10-01' })
    const direct = replaySkill(sk, p, '2026-10-20')
    // "abrir" o app em vários dias intermediários não muda o resultado final
    for (const d of ['2026-10-05', '2026-10-11', '2026-10-15'] as ISODate[]) replaySkill(sk, p, d)
    expect(replaySkill(sk, p, '2026-10-20').condition).toBe(direct.condition)
    expect(direct.daysSinceLast).toBe(19)
    expect(direct.status).toBe('rusting')
  })

  it('práticas futuras e de outras habilidades são ignoradas', () => {
    const p = [practice(START), practice(addDays(START, 30)), practice(START, 30, { skillId: 'outra' })]
    expect(replaySkill(skill(), p, addDays(START, 5)).totalPractices).toBe(1)
  })

  it('peso da contribuição reduz o efeito', () => {
    const full = replaySkill(skill(), [practice(START)], START)
    const partial = replaySkill(skill(), [practice(START, 30, { weight: 0.2 })], START)
    expect(partial.experience).toBeCloseTo(full.experience * 0.2)
  })
})
