import { describe, expect, it } from 'vitest'
import { addDays, diffDays, getProductivityDate, mondayIndex, monthGrid, startOfWeek } from '../date'

describe('date utils', () => {
  it('semana começa na segunda', () => {
    expect(startOfWeek('2026-10-05')).toBe('2026-10-05') // segunda
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05') // domingo
    expect(mondayIndex('2026-10-11')).toBe(6)
  })
  it('soma e diferença de dias atravessando meses', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(diffDays('2026-02-27', '2026-03-02')).toBe(3)
  })
  it('dia de produtividade respeita a hora de virada', () => {
    expect(getProductivityDate(new Date(2026, 9, 6, 2, 30), 4)).toBe('2026-10-05')
    expect(getProductivityDate(new Date(2026, 9, 6, 4, 0), 4)).toBe('2026-10-06')
  })
  it('grade mensal tem semanas completas', () => {
    const grid = monthGrid('2026-10-01')
    expect(grid.every((w) => w.length === 7)).toBe(true)
    expect(grid[0]![3]).toBe('2026-10-01') // quinta
  })
})
