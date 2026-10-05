/**
 * Formato persistido da aplicação. É o "banco de dados" local; trocar
 * localStorage por IndexedDB ou uma API exige apenas outro StorageAdapter.
 */
import type { ISODate, Timestamp } from '@/domain/date'
import type { DailyRecord } from '@/domain/models/day'
import type { LedgerEntry, UnlockedAchievement } from '@/domain/models/gamification'
import type { Habit, HabitLog } from '@/domain/models/habit'
import type { HabitSkillContribution, Skill, SkillPractice } from '@/domain/models/skill'
import type { Task } from '@/domain/models/task'

export type ThemePreference = 'dark' | 'light' | 'system'

export interface Profile {
  name: string
  onboardedAt: Timestamp | null
  /** Primeiro dia de uso — base para histórico e encerramento automático. */
  startDate: ISODate | null
}

export interface Settings {
  theme: ThemePreference
  /** Hora em que o "dia de produtividade" vira (0–6). */
  dayStartHour: number
}

export interface AppData {
  profile: Profile
  settings: Settings
  habits: Habit[]
  logs: HabitLog[]
  tasks: Task[]
  records: Record<string, DailyRecord>
  ledger: LedgerEntry[]
  achievements: Record<string, UnlockedAchievement>
  /* v2 — habilidades */
  skills: Skill[]
  skillPractices: SkillPractice[]
  skillLinks: HabitSkillContribution[]
}

export const SCHEMA_VERSION = 2

export function createEmptyData(): AppData {
  return {
    profile: { name: '', onboardedAt: null, startDate: null },
    settings: { theme: 'dark', dayStartHour: 4 },
    habits: [],
    logs: [],
    tasks: [],
    records: {},
    ledger: [],
    achievements: {},
    skills: [],
    skillPractices: [],
    skillLinks: [],
  }
}

/** Migrações de schema persistido (versão antiga → atual). */
export function migrateData(persisted: unknown, fromVersion: number): AppData {
  const base = createEmptyData()
  if (!persisted || typeof persisted !== 'object') return base
  const data = persisted as Partial<AppData>
  // v1 → v2: habilidades (listas vazias). Campos ausentes recebem o padrão.
  void fromVersion
  return {
    ...base,
    ...data,
    profile: { ...base.profile, ...data.profile },
    settings: { ...base.settings, ...data.settings },
    skills: data.skills ?? [],
    skillPractices: data.skillPractices ?? [],
    skillLinks: data.skillLinks ?? [],
  }
}
