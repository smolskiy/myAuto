import { expect, test } from 'vitest'
import { tireSetMileage } from './tires'
import { service } from './fixtures'

const swap = (date: string, odometer: number, mountedSetId?: string, removedSetId?: string) =>
  service({ date, odometer, serviceType: 'tires', tireSwap: { mountedSetId, removedSetId } })

test('пробег комплекта по сезонам, текущий сезон — до текущего пробега', () => {
  const recs = [swap('2025-11-01', 100000, 'W', 'S'), swap('2026-04-01', 105000, 'S', 'W'), swap('2026-11-01', 110000, 'W', 'S')]
  expect(tireSetMileage(recs, 'W', 112000)).toBe(7000)
  expect(tireSetMileage(recs, 'S', 112000)).toBe(5000)
  expect(tireSetMileage(recs, 'W', null)).toBe(5000)
})
