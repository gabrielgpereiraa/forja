/**
 * Utilitários de data do domínio.
 *
 * O domínio trabalha com datas de calendário locais no formato `YYYY-MM-DD`
 * (nunca com timestamps), o que torna comparações e agrupamentos triviais e
 * evita bugs de fuso horário.
 */
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export type ISODate = `${number}-${number}-${number}`
/** Timestamp ISO-8601 completo (instante). */
export type Timestamp = string

/** 0 = domingo … 6 = sábado (convenção JS). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const WEEKDAYS_MONDAY_FIRST: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0]

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(date: Date): ISODate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as ISODate
}

export function isISODate(value: string): value is ISODate {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d, 12) // meio-dia evita problemas de horário de verão
}

export function addDays(iso: ISODate, amount: number): ISODate {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + amount)
  return toISODate(d)
}

/** Diferença em dias de calendário (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  const ms = parseISODate(b).getTime() - parseISODate(a).getTime()
  return Math.round(ms / 86_400_000)
}

export function weekdayOf(iso: ISODate): Weekday {
  return parseISODate(iso).getDay() as Weekday
}

/** Índice do dia na semana começando na segunda (0 = segunda … 6 = domingo). */
export function mondayIndex(day: Weekday | ISODate): number {
  const wd = typeof day === 'number' ? day : weekdayOf(day)
  return (wd + 6) % 7
}

export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, -mondayIndex(iso))
}

export function weekDates(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

export function dateRange(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/**
 * "Dia de produtividade": atividades feitas de madrugada (antes de
 * `dayStartHour`) contam para o dia anterior.
 */
export function getProductivityDate(now: Date, dayStartHour: number): ISODate {
  const shifted = new Date(now)
  if (shifted.getHours() < dayStartHour) shifted.setDate(shifted.getDate() - 1)
  return toISODate(shifted)
}

export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01` as ISODate
}

export function addMonths(iso: ISODate, amount: number): ISODate {
  const d = parseISODate(startOfMonth(iso))
  d.setMonth(d.getMonth() + amount)
  return toISODate(d)
}

/** Grade do calendário mensal (semanas começando na segunda), com `null` para dias fora do mês. */
export function monthGrid(monthStart: ISODate): (ISODate | null)[][] {
  const first = startOfMonth(monthStart)
  const firstDate = parseISODate(first)
  const daysInMonth = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0).getDate()
  const offset = mondayIndex(first)
  const cells: (ISODate | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (ISODate | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/* ------------------------------ Formatação ------------------------------ */

export function formatDate(iso: ISODate, pattern: string): string {
  return format(parseISODate(iso), pattern, { locale: ptBR })
}

export const WEEKDAY_SHORT: Record<Weekday, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
}

export const WEEKDAY_LETTER: Record<Weekday, string> = { 0: 'D', 1: 'S', 2: 'T', 3: 'Q', 4: 'Q', 5: 'S', 6: 'S' }

/** "Hoje", "Amanhã", "Ontem", "qua, 7 out" */
export function relativeDayLabel(iso: ISODate, today: ISODate): string {
  const diff = diffDays(today, iso)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  if (diff === -1) return 'Ontem'
  if (diff > 1 && diff < 7) return capitalize(formatDate(iso, 'EEEE'))
  return formatDate(iso, "EEE, d 'de' MMM")
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function nowTimestamp(): Timestamp {
  return new Date().toISOString()
}
