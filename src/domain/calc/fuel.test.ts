import { expect, test } from 'vitest'
import { averageConsumption, fuelIntervals, solveFuelTriple } from './fuel'
import { fuel, service } from './fixtures'

const fills = [
  fuel({ id: 'f1', date: '2026-01-01', odometer: 1000, liters: 40 }),
  fuel({ id: 'f2', date: '2026-01-10', odometer: 1500, liters: 20, fullTank: false }),
  service({ id: 's', date: '2026-01-15', odometer: 1600 }),
  fuel({ id: 'f3', date: '2026-01-20', odometer: 1800, liters: 25 }),
  fuel({ id: 'f4', date: '2026-02-01', odometer: 2300, liters: 30, missedBefore: true }),
  fuel({ id: 'f5', date: '2026-02-10', odometer: 2700, liters: 32 }),
]

test('полный бак → полный бак, пропуск рвёт цепочку', () => {
  const iv = fuelIntervals(fills)
  expect(iv.map((i) => [i.fromId, i.toId, i.km, i.liters])).toEqual([
    ['f1', 'f3', 800, 45],
    ['f4', 'f5', 400, 32],
  ])
  expect(iv[0]!.lPer100km).toBeCloseTo(5.625, 3)
  expect(iv[1]!.lPer100km).toBeCloseTo(8, 3)
})

test('средний расход взвешен по км и фильтруется по периоду', () => {
  const iv = fuelIntervals(fills)
  expect(averageConsumption(iv)).toBeCloseTo(((45 + 32) / 1200) * 100, 3)
  expect(averageConsumption(iv, { from: '2026-02-01' })).toBeCloseTo(8, 3)
  expect(averageConsumption([])).toBeNull()
})

test('заправка без пробега (не полный бак) идёт в литры интервала, удалённые не учитываются', () => {
  const iv = fuelIntervals([
    fuel({ id: 'a', date: '2026-01-01', odometer: 0, liters: 40 }),
    fuel({ id: 'b', date: '2026-01-05', odometer: undefined, liters: 10, fullTank: false }),
    fuel({ id: 'z', date: '2026-01-06', odometer: 300, liters: 99, deleted: true }),
    fuel({ id: 'c', date: '2026-01-10', odometer: 500, liters: 30 }),
  ])
  expect(iv.map((i) => [i.fromId, i.toId, i.liters])).toEqual([['a', 'c', 40]])
})

test('заправки одного дня — в порядке ввода, пробег в сравнение не входит', () => {
  const iv = fuelIntervals([
    fuel({ id: 'a', date: '2026-03-01', odometer: 1000, liters: 40, createdAt: 1 }),
    fuel({ id: 'b', date: '2026-03-05', odometer: 1500, liters: 30, createdAt: 2 }),
    fuel({ id: 'p', date: '2026-03-05', odometer: undefined, liters: 5, fullTank: false, createdAt: 3 }),
    fuel({ id: 'c', date: '2026-03-10', odometer: 2000, liters: 30, createdAt: 4 }),
  ])
  expect(iv.map((i) => [i.fromId, i.toId, i.liters, i.km])).toEqual([
    ['a', 'b', 30, 500],
    ['b', 'c', 35, 500],
  ])
  expect(iv[0]!.lPer100km).toBeCloseTo(6, 5)
  expect(iv[1]!.lPer100km).toBeCloseTo(7, 5)
})

test('два из трёх', () => {
  expect(solveFuelTriple({ liters: 40, pricePerLiter: 5690 })).toEqual({ liters: 40, pricePerLiter: 5690, total: 227600 })
  expect(solveFuelTriple({ total: 227600, pricePerLiter: 5690 })).toEqual({ liters: 40, pricePerLiter: 5690, total: 227600 })
  expect(solveFuelTriple({ liters: 42.37, total: 250000 })).toEqual({ liters: 42.37, pricePerLiter: 5900, total: 250000 })
  expect(solveFuelTriple({ liters: 40 })).toBeNull()
  expect(solveFuelTriple({ liters: 0, pricePerLiter: 5690 })).toBeNull()
})
