import { expect, test } from 'vitest'
import { averageDailyKm, checkOdometer, currentOdometer } from './odometer'
import { odo, service } from './fixtures'

const history = [
  odo({ id: 'a', date: '2026-01-01', odometer: 1000 }),
  odo({ id: 'b', date: '2026-02-01', odometer: 1500 }),
  service({ id: 'c', date: '2026-03-01', odometer: 2000 }),
  odo({ id: 'x', date: '2026-03-05', odometer: 9999, deleted: true }),
]

test('текущий пробег — максимум живых записей или пробег при покупке', () => {
  expect(currentOdometer(history)).toBe(2000)
  expect(currentOdometer([], { purchase: { odometer: 900 } })).toBe(900)
  expect(currentOdometer([])).toBeNull()
})

test('хронология: запись задним числом сверяется с соседями по дате', () => {
  expect(checkOdometer(history, { date: '2026-02-15', odometer: 1700 })).toEqual({ ok: true })
  expect(checkOdometer(history, { date: '2026-02-15', odometer: 1400 })).toEqual({
    ok: false, reason: 'lessThanEarlier', conflict: { date: '2026-02-01', odometer: 1500 },
  })
  expect(checkOdometer(history, { date: '2026-02-15', odometer: 2100 })).toEqual({
    ok: false, reason: 'greaterThanLater', conflict: { date: '2026-03-01', odometer: 2000 },
  })
})

test('правка записи не конфликтует сама с собой', () => {
  expect(checkOdometer(history, { id: 'b', date: '2026-02-01', odometer: 1200 })).toEqual({ ok: true })
})

test('средний пробег в день', () => {
  expect(averageDailyKm(history, '2026-03-31')).toBeCloseTo(1000 / 59, 3) // 2026-01-01..2026-03-01 в окне 180 дней
  expect(averageDailyKm([odo({ date: '2026-03-01', odometer: 1 })], '2026-03-31')).toBeNull()
  // окно 180 дней покрывает < 14 дней → берётся вся история
  const sparse = [odo({ date: '2025-01-01', odometer: 0 }), odo({ date: '2026-03-20', odometer: 10000 }), odo({ date: '2026-03-25', odometer: 10100 })]
  expect(averageDailyKm(sparse, '2026-03-31')).toBeCloseTo(10100 / 448, 3)
})
