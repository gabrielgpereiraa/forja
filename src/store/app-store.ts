/**
 * Store global (Zustand). Guarda o AppData persistido e expõe ações que
 * delegam para os comandos puros em `services/commands`.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { getProductivityDate, type ISODate } from '@/domain/date'
import type { HabitInput } from '@/domain/models/habit'
import type { GoalProposal } from '@/domain/rules/habit-progression'
import type { LedgerEntry } from '@/domain/models/gamification'
import type { SkillInput } from '@/domain/models/skill'
import type { Task, TaskInput } from '@/domain/models/task'
import { createEmptyData, migrateData, SCHEMA_VERSION, type AppData, type Profile, type Settings } from '@/services/app-data'
import * as cmd from '@/services/commands'
import * as skills from '@/services/skill-commands'
import type { LinkInput, PracticeInput } from '@/services/skill-commands'
import { buildDemoData } from '@/services/demo-seed'
import { cloudEnabled } from '@/lib/supabase'
import { createLocalStorageAdapter, createScopedStorage, STORAGE_KEY } from '@/services/storage'

const scopedStorage = createScopedStorage(createLocalStorageAdapter())
// Com conta, nada é lido/gravado até o login definir o escopo do usuário.
scopedStorage.paused = cloudEnabled

export interface AppActions {
  completeOnboarding: (name: string, today: ISODate, withDemo: boolean) => void
  updateProfile: (patch: Partial<Pick<Profile, 'name'>>) => void
  updateSettings: (patch: Partial<Settings>) => void

  createHabit: (input: HabitInput, today: ISODate) => string
  updateHabit: (id: string, input: HabitInput, today: ISODate) => void
  applyHabitGoal: (id: string, goal: GoalProposal, today: ISODate) => void
  snoozeProgression: (id: string, today: ISODate) => void
  setHabitArchived: (id: string, archived: boolean) => void
  deleteHabit: (id: string, today: ISODate) => void
  toggleHabit: (id: string, date: ISODate) => cmd.Feedback
  setHabitValue: (id: string, date: ISODate, value: number) => cmd.Feedback
  /** Confirmação tardia de hábito "Confirmar na manhã seguinte" (dia já encerrado). */
  confirmLateHabit: (id: string, date: ISODate, today: ISODate, done: boolean) => cmd.Feedback

  createTask: (input: TaskInput, today: ISODate) => string
  updateTask: (id: string, input: TaskInput) => void
  setTaskCompleted: (id: string, completed: boolean, today: ISODate) => cmd.Feedback
  deleteTask: (id: string) => { task: Task; entries: LedgerEntry[] } | null
  restoreTask: (task: Task, entries: LedgerEntry[]) => void

  createSkill: (input: SkillInput, links: LinkInput[], today: ISODate) => { id: string; imported: number }
  updateSkill: (id: string, input: SkillInput, links: LinkInput[], today: ISODate) => void
  setSkillArchived: (id: string, archived: boolean) => void
  deleteSkill: (id: string) => void
  logSkillPractice: (id: string, input: PracticeInput, date: ISODate) => cmd.Feedback & { via: 'habit' | 'skill' }
  removeSkillPractice: (practiceId: string, today: ISODate) => void

  closeDay: (date: ISODate) => cmd.Feedback
  autoCloseMissedDays: (today: ISODate) => void

  loadDemo: (today: ISODate) => void
  resetAll: () => void
  importData: (data: AppData) => void
}

export type AppState = AppData & AppActions

function dataOf(state: AppState): AppData {
  const { profile, settings, habits, logs, tasks, records, ledger, achievements, skills, skillPractices, skillLinks } = state
  return { profile, settings, habits, logs, tasks, records, ledger, achievements, skills, skillPractices, skillLinks }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      const run = (fn: (d: AppData) => cmd.CommandResult): cmd.Feedback => {
        const result = fn(dataOf(get()))
        set(result.data)
        return result.feedback
      }
      const apply = (fn: (d: AppData) => AppData) => set(fn(dataOf(get())))
      /** Dia de produtividade atual: os comandos o usam para bloquear datas passadas. */
      const currentDay = () => getProductivityDate(new Date(), get().settings.dayStartHour)

      return {
        ...createEmptyData(),

        completeOnboarding: (name, today, withDemo) =>
          set(withDemo ? buildDemoData(today, name) : cmd.completeOnboarding(dataOf(get()), name, today)),
        updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

        createHabit: (input, today) => {
          const r = cmd.createHabit(dataOf(get()), input, today)
          set(r.data)
          return r.habit.id
        },
        updateHabit: (id, input, today) => apply((d) => cmd.updateHabit(d, id, input, today)),
        applyHabitGoal: (id, goal, today) => apply((d) => cmd.applyHabitGoal(d, id, goal, today)),
        snoozeProgression: (id, today) => apply((d) => cmd.snoozeProgression(d, id, today)),
        setHabitArchived: (id, archived) => apply((d) => cmd.setHabitArchived(d, id, archived)),
        deleteHabit: (id, today) => apply((d) => cmd.deleteHabit(d, id, today)),
        toggleHabit: (id, date) => run((d) => cmd.toggleHabit(d, id, date, currentDay())),
        setHabitValue: (id, date, value) => run((d) => cmd.setHabitValue(d, id, date, value, currentDay())),
        confirmLateHabit: (id, date, today, done) => run((d) => cmd.confirmLateHabit(d, id, date, today, done)),

        createTask: (input, today) => {
          const r = cmd.createTask(dataOf(get()), input, today)
          set(r.data)
          return r.task.id
        },
        updateTask: (id, input) => apply((d) => cmd.updateTask(d, id, input)),
        setTaskCompleted: (id, completed, date) => run((d) => cmd.setTaskCompleted(d, id, completed, date, currentDay())),
        deleteTask: (id) => {
          const r = cmd.deleteTask(dataOf(get()), id)
          if (r.removed) set(r.data)
          return r.removed ? { task: r.removed, entries: r.entries } : null
        },
        restoreTask: (task, entries) => apply((d) => cmd.restoreTask(d, task, entries)),

        createSkill: (input, links, today) => {
          const r = skills.createSkill(dataOf(get()), input, links, today)
          set(r.data)
          return { id: r.skill.id, imported: r.imported }
        },
        updateSkill: (id, input, links, today) => apply((d) => skills.setSkillLinks(skills.updateSkill(d, id, input), id, links, today)),
        setSkillArchived: (id, archived) => apply((d) => skills.setSkillArchived(d, id, archived)),
        deleteSkill: (id) => apply((d) => skills.deleteSkill(d, id, currentDay())),
        logSkillPractice: (id, input, date) => {
          const r = skills.logSkillPractice(dataOf(get()), id, input, date)
          set(r.data)
          return { ...r.feedback, via: r.via }
        },
        removeSkillPractice: (practiceId, today) => apply((d) => skills.removeSkillPractice(d, practiceId, today)),

        closeDay: (date) => run((d) => cmd.closeDay(d, date, 'user', currentDay())),
        autoCloseMissedDays: (today) => {
          const before = dataOf(get())
          const after = cmd.autoCloseMissedDays(before, today)
          if (after !== before) set(after)
        },

        loadDemo: (today) => {
          const { profile, settings } = get()
          set({ ...buildDemoData(today, profile.name || 'Nino'), settings })
        },
        resetAll: () => set(createEmptyData()),
        importData: (data) => set(migrateData(data, SCHEMA_VERSION)),
      }
    },
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(() => scopedStorage),
      skipHydration: cloudEnabled,
      partialize: (s) => dataOf(s),
      migrate: (persisted, version) => migrateData(persisted, version) as unknown as AppState,
    },
  ),
)

export function exportData(): AppData {
  return dataOf(useAppStore.getState())
}

export function getAppData(): AppData {
  return dataOf(useAppStore.getState())
}

/** Substitui o estado sem passar pelas ações (usado pela sincronização). */
export function setAppData(data: AppData): void {
  useAppStore.setState(data)
}

/** Assina mudanças do AppData (estado anterior e novo). */
export function subscribeAppData(listener: (next: AppData, prev: AppData) => void): () => void {
  return useAppStore.subscribe((state, prev) => listener(dataOf(state), dataOf(prev)))
}

/**
 * Troca o "dono" do estado local: limpa a memória, aponta o armazenamento
 * para a chave do usuário e reidrata o cache dele. `null` = ninguém logado
 * (estado vazio e escrita pausada).
 */
export async function switchDataScope(userId: string | null): Promise<void> {
  scopedStorage.paused = true
  useAppStore.setState(createEmptyData())
  scopedStorage.scope = userId
  if (!userId) return
  scopedStorage.paused = false
  await useAppStore.persist.rehydrate()
}

/** Apaga o cache local do usuário atual (ao sair da conta). */
export function clearScopedCache(): void {
  scopedStorage.removeItem(STORAGE_KEY)
}
