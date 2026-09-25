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

test('сверка с максимумом всех более ранних и минимумом всех более поздних записей', () => {
  const messy = [odo({ date: '2026-01-01', odometer: 1000 }), odo({ date: '2026-02-01', odometer: 500 })]
  expect(checkOdometer(messy, { date: '2026-02-15', odometer: 700 })).toEqual({
    ok: false, reason: 'lessThanEarlier', conflict: { date: '2026-01-01', odometer: 1000 },
  })
  const later = [odo({ date: '2026-03-01', odometer: 3000 }), odo({ date: '2026-04-01', odometer: 2500 })]
  expect(checkOdometer(later, { date: '2026-02-15', odometer: 2800 })).toEqual({
    ok: false, reason: 'greaterThanLater', conflict: { date: '2026-04-01', odometer: 2500 },
  })
})

test('запись того же дня: расхождение больше 2000 км — sameDayGap', () => {
  const sameDay = [odo({ id: 's', date: '2026-05-01', odometer: 150000 })]
  expect(checkOdometer(sameDay, { date: '2026-05-01', odometer: 15000 })).toEqual({
    ok: false, reason: 'sameDayGap', conflict: { date: '2026-05-01', odometer: 150000 },
  })
  expect(checkOdometer(sameDay, { date: '2026-05-01', odometer: 150400 })).toEqual({ ok: true })
  expect(checkOdometer(sameDay, { id: 's', date: '2026-05-01', odometer: 15000 })).toEqual({ ok: true })
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
