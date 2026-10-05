/**
 * Dados de exemplo: simula ~5 semanas de uso passando pelos MESMOS comandos
 * do usuário real (logo, XP, notas e conquistas são consistentes).
 */
import { addDays, nowTimestamp, weekdayOf, type ISODate } from '@/domain/date'
import { createId } from '@/domain/models/ids'
import type { SkillInput, SkillPractice } from '@/domain/models/skill'
import type { HabitInput } from '@/domain/models/habit'
import type { TaskInput, TaskPriority } from '@/domain/models/task'
import { createEmptyData, type AppData } from './app-data'
import * as cmd from './commands'
import * as skills from './skill-commands'
import { commitSkillChanges } from './skill-sync'

function prng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DEMO_HABITS: (HabitInput & { chance: number })[] = [
  { name: 'Treinar guitarra', category: 'creative', icon: 'guitar', color: 'violet', schedule: { weeklyGoal: 4, days: null }, target: { amount: 30, unit: 'minutes' }, chance: 0.62 },
  { name: 'Exercícios', category: 'health', icon: 'dumbbell', color: 'lime', schedule: { weeklyGoal: 5, days: null }, target: null, chance: 0.72 },
  { name: 'Ler', category: 'study', icon: 'book', color: 'amber', schedule: { weeklyGoal: 5, days: null }, target: { amount: 20, unit: 'pages' }, chance: 0.66 },
  { name: 'Meditar', category: 'mind', icon: 'leaf', color: 'emerald', schedule: { weeklyGoal: 3, days: [1, 3, 5] }, target: { amount: 10, unit: 'minutes' }, chance: 0.8 },
  { name: 'Dormir até 23h', category: 'health', icon: 'bed', color: 'indigo', schedule: { weeklyGoal: 5, days: null }, target: null, confirmNextDay: true, chance: 0.6 },
  { name: 'Estudar inglês', category: 'study', icon: 'languages', color: 'sky', schedule: { weeklyGoal: 3, days: null }, target: { amount: 20, unit: 'minutes' }, chance: 0.5, description: 'Duolingo + uma série sem legenda' },
]

const TASK_POOL: [string, TaskPriority][] = [
  ['Pagar conta de luz', 'high'],
  ['Comprar ração', 'normal'],
  ['Levar roupa na lavanderia', 'low'],
  ['Revisar currículo', 'normal'],
  ['Agendar dentista', 'high'],
  ['Trocar lâmpada da cozinha', 'low'],
  ['Separar recicláveis', 'low'],
  ['Responder e-mail do condomínio', 'normal'],
  ['Atualizar planilha de gastos', 'normal'],
  ['Comprar presente da Ana', 'high'],
  ['Lavar o carro', 'low'],
  ['Organizar fotos do celular', 'low'],
  ['Renovar assinatura da academia', 'normal'],
  ['Devolver livro da biblioteca', 'normal'],
]

export function buildDemoData(today: ISODate, name: string, days = 41): AppData {
  const rand = prng(42)
  const start = addDays(today, -days)
  let data = cmd.completeOnboarding(createEmptyData(), name, start)
  data = { ...data, profile: { ...data.profile, startDate: start } }

  const habitIds: { id: string; chance: number; target: number }[] = []
  for (const h of DEMO_HABITS) {
    const { chance, ...input } = h
    const r = cmd.createHabit(data, input, start)
    data = r.data
    habitIds.push({ id: r.habit.id, chance, target: input.target?.amount ?? 1 })
  }

  const yesterday = addDays(today, -1)
  const sleepIndex = DEMO_HABITS.findIndex((h) => h.confirmNextDay)
  for (let d = start; d < today; d = addDays(d, 1)) {
    const isYesterday = d === yesterday
    const wd = weekdayOf(d)
    const weekend = wd === 0 || wd === 6
    // Alguns dias ruins espalhados, e uma melhora gradual ao longo do tempo.
    const progressFactor = 0.85 + (0.25 * (days - Math.max(0, (Date.parse(today) - Date.parse(d)) / 86_400_000))) / days
    const daysAgo = Math.round((Date.parse(today) - Date.parse(d)) / 86_400_000)
    // A última semana é boa: o painel de exemplo mostra uma sequência viva.
    const finalStretch = daysAgo <= 6
    const badDay = !finalStretch && rand() < 0.12
    for (const [i, h] of habitIds.entries()) {
      const def = DEMO_HABITS[i]!
      if (def.schedule.days && !def.schedule.days.includes(wd)) continue
      // Ontem: o sono ainda não foi confirmado — fica para a revisão da manhã.
      if (isYesterday && i === sleepIndex) continue
      // Guitarra: rotina sólida (seg, ter, qui, sáb) — gera a sugestão de subir a meta.
      if (i === 0) {
        if ([1, 2, 4, 6].includes(wd)) data = cmd.setHabitValue(data, h.id, d, h.target).data
        continue
      }
      const p = finalStretch ? (rand() < 0.9 ? 1 : 0) : h.chance * progressFactor * (badDay ? 0.3 : 1) * (weekend ? 0.8 : 1)
      if (rand() < p) {
        const partial = h.target > 1 && rand() < 0.12
        const value = partial ? Math.round(h.target * (0.4 + rand() * 0.4)) : h.target + (h.target > 1 && rand() < 0.25 ? Math.round(h.target * 0.5) : 0)
        data = cmd.setHabitValue(data, h.id, d, value).data
      }
    }
    const nTasks = weekend ? (rand() < 0.5 ? 1 : 0) : 1 + Math.floor(rand() * 3)
    for (let k = 0; k < nTasks; k++) {
      const [title, priority] = TASK_POOL[Math.floor(rand() * TASK_POOL.length)]!
      const r = cmd.createTask(data, { title, priority, dueDate: d }, addDays(d, -1))
      data = r.data
      if (finalStretch || rand() < (badDay ? 0.35 : 0.8)) data = cmd.setTaskCompleted(data, r.task.id, true, d).data
    }
    // Tarefas atrasadas acabam sendo resolvidas em algum momento.
    for (const t of data.tasks) {
      if (!t.completed && t.dueDate && t.dueDate < d && (finalStretch || rand() < 0.5)) data = cmd.setTaskCompleted(data, t.id, true, d).data
    }
    if (isYesterday) {
      // Ontem fica aberto, com uma pendência para a revisão da manhã.
      data = cmd.createTask(data, { title: 'Responder e-mail do condomínio', priority: 'normal', dueDate: d }, addDays(d, -1)).data
      continue
    }
    data = cmd.closeDay(data, d, rand() < 0.85 ? 'user' : 'auto').data
  }

  // Hoje: um dia em andamento, como no painel de referência.
  const [guitar, exercise] = habitIds
  if (exercise) data = cmd.setHabitValue(data, exercise.id, today, 1).data
  if (guitar) data = cmd.setHabitValue(data, guitar.id, today, 20).data
  const todayTasks: (TaskInput & { done?: boolean })[] = [
    { title: 'Limpar tênis', priority: 'normal', dueDate: today, done: true },
    { title: 'Organizar mesa', priority: 'low', dueDate: today },
    { title: 'Comprar detergente', priority: 'normal', dueDate: today },
  ]
  for (const t of todayTasks) {
    const { done, ...input } = t
    const r = cmd.createTask(data, input, addDays(today, -1))
    data = r.data
    if (done) data = cmd.setTaskCompleted(data, r.task.id, true, today).data
  }
  data = cmd.createTask(data, { title: 'Consertar bicicleta', priority: 'normal', dueDate: addDays(today, 2) }, today).data
  data = cmd.createTask(data, { title: 'Comprar um livro novo', priority: 'low', dueDate: null }, today).data
  data = cmd.createTask(data, { title: 'Marcar revisão do carro', priority: 'high', dueDate: addDays(today, 5) }, today).data
  return seedSkills(data, today, rand)
}

/**
 * Habilidades de exemplo: as ligadas a hábitos importam o histórico simulado;
 * "Programação" tem meses de prática avulsa e está parada há ~4 semanas —
 * nível e maestria altos, condição caindo (o caso "experiente, mas enferrujado").
 */
function seedSkills(data: AppData, today: ISODate, rand: () => number): AppData {
  const byName = (name: string) => data.habits.find((h) => h.name === name)
  const linked: { input: SkillInput; habit: string; extra?: { habit: string; weight: number }[] }[] = [
    { input: { name: 'Guitarra', category: 'creative', icon: 'guitar', color: 'violet', maintenancePerWeek: 2, sessionMinutes: 30, description: 'Técnica, repertório e ouvido.' }, habit: 'Treinar guitarra' },
    { input: { name: 'Condicionamento', category: 'health', icon: 'dumbbell', color: 'lime', maintenancePerWeek: 3, sessionMinutes: 45 }, habit: 'Exercícios' },
    { input: { name: 'Inglês', category: 'study', icon: 'languages', color: 'sky', maintenancePerWeek: 3, sessionMinutes: 20 }, habit: 'Estudar inglês' },
    { input: { name: 'Leitura', category: 'study', icon: 'book', color: 'amber', maintenancePerWeek: 3, sessionMinutes: 20 }, habit: 'Ler', extra: [{ habit: 'Estudar inglês', weight: 0.2 }] },
  ]
  for (const s of linked) {
    const habit = byName(s.habit)
    if (!habit) continue
    const links = [{ habitId: habit.id, weight: 1 }, ...(s.extra ?? []).flatMap((e) => (byName(e.habit) ? [{ habitId: byName(e.habit)!.id, weight: e.weight }] : []))]
    // O histórico dos hábitos é importado; recompensas de nível sincronizadas até hoje.
    data = skills.createSkill(data, s.input, links, today).data
  }

  const prog = skills.createSkill(
    data,
    { name: 'Programação', category: 'career', icon: 'code', color: 'emerald', maintenancePerWeek: 3, sessionMinutes: 45, description: 'Projetos pessoais e estudo de TypeScript.' },
    [],
    addDays(today, -260),
  )
  data = prog.data
  const practices: SkillPractice[] = []
  for (let d = addDays(today, -260); d <= addDays(today, -27); d = addDays(d, 1)) {
    const wd = weekdayOf(d)
    if (wd === 0 || rand() > 0.62) continue
    practices.push({
      id: createId('sp'),
      skillId: prog.skill.id,
      date: d,
      duration: [30, 45, 60, 90][Math.floor(rand() * 4)]!,
      value: null,
      unit: 'minutes',
      intensity: 1,
      weight: 1,
      sourceHabitId: null,
      sourceLogId: null,
      createdAt: nowTimestamp(),
    })
  }
  return commitSkillChanges(data, [...data.skillPractices, ...practices], [prog.skill.id], today).data
}
