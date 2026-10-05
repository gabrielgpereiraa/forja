/**
 * Estado efêmero de UI (não persistido): quais formulários/painéis estão
 * abertos. Permite abrir "Novo hábito" ou "Registrar sessão" de qualquer tela.
 */
import { create } from 'zustand'

import type { ISODate } from '@/domain/date'
import type { HabitInput } from '@/domain/models/habit'
import type { SkillInput } from '@/domain/models/skill'
import type { TaskInput } from '@/domain/models/task'
import type { LinkInput } from '@/services/skill-commands'

type HabitFormState = { open: false } | { open: true; habitId: string | null; preset?: Partial<HabitInput> }
type SkillFormState = { open: false } | { open: true; skillId: string | null; preset?: SkillPreset }
export interface SkillPreset {
  input?: Partial<SkillInput>
  links?: LinkInput[]
}
type TaskFormState = { open: false } | { open: true; taskId: string | null; preset?: Partial<TaskInput> }

interface UiState {
  habitForm: HabitFormState
  taskForm: TaskFormState
  habitLog: { habitId: string; date: ISODate } | null
  dayDetail: ISODate | null
  quickAdd: boolean
  skillForm: SkillFormState
  skillDetail: string | null
  practiceSheet: string | null
  openSkillForm: (skillId?: string | null, preset?: SkillPreset) => void
  closeSkillForm: () => void
  openSkillDetail: (skillId: string) => void
  closeSkillDetail: () => void
  openPracticeSheet: (skillId: string) => void
  closePracticeSheet: () => void
  openHabitForm: (habitId?: string | null, preset?: Partial<HabitInput>) => void
  openTaskForm: (taskId?: string | null, preset?: Partial<TaskInput>) => void
  closeHabitForm: () => void
  closeTaskForm: () => void
  openHabitLog: (habitId: string, date: ISODate) => void
  closeHabitLog: () => void
  openDayDetail: (date: ISODate) => void
  closeDayDetail: () => void
  setQuickAdd: (open: boolean) => void
}

export const useUiStore = create<UiState>()((set) => ({
  habitForm: { open: false },
  taskForm: { open: false },
  habitLog: null,
  dayDetail: null,
  quickAdd: false,
  skillForm: { open: false },
  skillDetail: null,
  practiceSheet: null,
  openSkillForm: (skillId = null, preset) => set({ skillForm: { open: true, skillId, ...(preset ? { preset } : {}) }, quickAdd: false }),
  closeSkillForm: () => set({ skillForm: { open: false } }),
  openSkillDetail: (skillDetail) => set({ skillDetail }),
  closeSkillDetail: () => set({ skillDetail: null }),
  openPracticeSheet: (practiceSheet) => set({ practiceSheet }),
  closePracticeSheet: () => set({ practiceSheet: null }),
  openHabitForm: (habitId = null, preset) => set({ habitForm: { open: true, habitId, ...(preset ? { preset } : {}) }, quickAdd: false }),
  openTaskForm: (taskId = null, preset) => set({ taskForm: { open: true, taskId, ...(preset ? { preset } : {}) }, quickAdd: false }),
  closeHabitForm: () => set({ habitForm: { open: false } }),
  closeTaskForm: () => set({ taskForm: { open: false } }),
  openHabitLog: (habitId, date) => set({ habitLog: { habitId, date } }),
  closeHabitLog: () => set({ habitLog: null }),
  openDayDetail: (date) => set({ dayDetail: date }),
  closeDayDetail: () => set({ dayDetail: null }),
  setQuickAdd: (quickAdd) => set({ quickAdd }),
}))
