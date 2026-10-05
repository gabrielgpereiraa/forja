import type { LevelInfo } from '../models/gamification'

/**
 * Curva de níveis: XP total para alcançar o nível L = 80·L·(L−1).
 * L2 = 160, L3 = 480, L5 = 1.600, L10 = 7.200, L20 = 30.400.
 * Um mês consistente (~150 XP/dia) leva por volta do nível 8.
 */
export function xpForLevel(level: number): number {
  return 80 * level * (level - 1)
}

const TITLES: { from: number; title: string }[] = [
  { from: 1, title: 'Iniciante' },
  { from: 3, title: 'Aprendiz' },
  { from: 5, title: 'Aventureiro' },
  { from: 8, title: 'Veterano' },
  { from: 12, title: 'Mestre' },
  { from: 18, title: 'Lendário' },
]

export function levelTitle(level: number): string {
  let title = TITLES[0]!.title
  for (const t of TITLES) if (level >= t.from) title = t.title
  return title
}

export function getLevelInfo(totalXp: number): LevelInfo {
  const xp = Math.max(0, totalXp)
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)
  const currentXp = xp - base
  const requiredXp = next - base
  return {
    level,
    title: levelTitle(level),
    totalXp: xp,
    currentXp,
    requiredXp,
    progress: requiredXp === 0 ? 0 : currentXp / requiredXp,
  }
}
