import { expect, test } from 'vitest'
import { addDays, addMonths, compareISO, diffDays, isISODate, monthKey, todayISO } from './dates'

test('проверка формата', () => {
  expect(isISODate('2026-09-25')).toBe(true)
  expect(isISODate('2026-02-30')).toBe(false)
  expect(isISODate('25.09.2026')).toBe(false)
})

test('сегодня — локальная дата', () => {
  expect(todayISO(new Date(2026, 8, 25, 23, 59))).toBe('2026-09-25')
})

test('сложение дат', () => {
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
  expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
  expect(addMonths('2026-09-25', 12)).toBe('2027-09-25')
  expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
})

test('разница и сравнение', () => {
  expect(diffDays('2026-01-01', '2026-01-31')).toBe(30)
  expect(diffDays('2026-03-31', '2026-03-01')).toBe(-30)
  expect(diffDays('2026-03-28', '2026-03-30')).toBe(2) // переход на летнее время не влияет
  expect(monthKey('2026-09-25')).toBe('2026-09')
  expect(compareISO('2026-01-02', '2026-01-10')).toBeLessThan(0)
})
