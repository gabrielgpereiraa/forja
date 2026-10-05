/**
 * Sequências (streaks) de dias positivos.
 *
 * - Dia positivo: encerrado com nota ≥ STREAK_MIN_SCORE.
 * - Dia neutro (nada planejado, nota `null`): não soma nem quebra.
 * - Hoje ainda aberto não quebra a sequência: ela fica "em jogo".
 */
import { addDays, type ISODate } from '../date'
import type { DailyRecord } from '../models/day'

export const STREAK_MIN_SCORE = 6

export type StreakStatus =
  /** Hoje já conta (encerrado e positivo). */
  | 'active'
  /** Sequência viva, aguardando o encerramento de hoje. */
  | 'pending'
  /** Ontem quebrou uma sequência existente. */
  | 'broken'
  | 'none'

export interface StreakInfo {
  current: number
  best: number
  status: StreakStatus
  /** Tamanho da sequência que acabou de ser quebrada (para o aviso). */
  lostLength: number
}

export type RecordMap = Readonly<Record<string, DailyRecord | undefined>>

const isPositive = (r: DailyRecord) => r.score !== null && r.score >= STREAK_MIN_SCORE
const isNeutral = (r: DailyRecord | undefined) => !r || r.score === null

/**
 * Conta dias positivos consecutivos terminando em `end` (inclusive), pulando
 * neutros. `pending` é um dia ainda em revisão (ontem aberto): não quebra.
 */
export function streakEndingAt(records: RecordMap, end: ISODate, floor: ISODate, pending?: ISODate): number {
  let count = 0
  let d = end
  for (let guard = 0; guard < 3660 && d >= floor; guard++, d = addDays(d, -1)) {
    if (d === pending && !records[d]) continue
    const r = records[d]
    if (!r) {
      // Dias sem registro (antes de usar o app) encerram a contagem.
      break
    }
    if (isNeutral(r)) continue
    if (isPositive(r)) count++
    else break
  }
  return count
}

export function computeStreak(records: RecordMap, today: ISODate): StreakInfo {
  const dates = Object.keys(records).sort() as ISODate[]
  const floor = dates[0] ?? today
  const todayRecord = records[today]
  const yesterday = addDays(today, -1)
  // Ontem sem registro = aguardando a revisão da manhã: fica "em jogo".
  const pending = !records[yesterday] && yesterday >= floor ? yesterday : undefined

  let current: number
  let status: StreakStatus
  let lostLength = 0

  if (todayRecord && !isNeutral(todayRecord)) {
    if (isPositive(todayRecord)) {
      current = streakEndingAt(records, today, floor, pending)
      status = 'active'
    } else {
      current = 0
      status = 'none'
    }
  } else {
    // Hoje aberto ou neutro: vale a sequência até ontem (pulando neutros).
    let d = yesterday
    while (d >= floor && (d === pending || (records[d] && isNeutral(records[d])))) d = addDays(d, -1)
    const last = records[d]
    if (last && !isPositive(last)) {
      current = 0
      lostLength = streakEndingAt(records, addDays(d, -1), floor)
      status = lostLength > 0 && d === yesterday ? 'broken' : 'none'
    } else {
      current = streakEndingAt(records, d, floor)
      status = current > 0 ? 'pending' : 'none'
    }
  }

  // Melhor sequência histórica.
  let best = 0
  let run = 0
  let prev: ISODate | null = null
  for (const date of dates) {
    const r = records[date]!
    if (prev !== null && addDays(prev, 1) !== date && !(addDays(prev, 2) === date && addDays(prev, 1) === pending)) run = 0
    prev = date
    if (isNeutral(r)) continue
    if (isPositive(r)) {
      run++
      best = Math.max(best, run)
    } else run = 0
  }
  best = Math.max(best, current)
  return { current, best, status, lostLength }
}
