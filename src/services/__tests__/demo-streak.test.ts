import { expect, it } from 'vitest'
import { computeStreak } from '@/domain/rules/streaks'
import { buildDemoData } from '../demo-seed'

it('dados de exemplo terminam com uma sequência ativa', () => {
  const d = buildDemoData('2026-10-05', 'Nino')
  expect(computeStreak(d.records, '2026-10-05').current).toBeGreaterThanOrEqual(5)
})
