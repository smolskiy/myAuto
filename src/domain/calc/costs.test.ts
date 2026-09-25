import { expect, test } from 'vitest'
import { costBreakdown, costPerKm, kmDriven } from './costs'
import { expense, fuel, odo, service } from './fixtures'

const records = [
  service({ date: '2026-08-10', odometer: 145000, total: 1245000,
    parts: [
      { id: 'p1', name: 'Фильтр', qty: 2, unit: 'pcs', unitPrice: 65000, ownPart: true },
      { id: 'p2', name: 'Масло', qty: 1, unit: 'set', unitPrice: 450000, ownPart: true },
      { id: 'p3', name: 'Без цены', qty: 1, unit: 'pcs', ownPart: false },
    ],
    works: [{ id: 'w1', name: 'Замена', price: 300000 }] }),
  fuel({ date: '2026-09-01', odometer: 146000, liters: 40, pricePerLiter: 5690, total: 227600 }),
  expense({ date: '2026-09-02', category: 'osago', total: 850000 }),
  odo({ date: '2026-09-20', odometer: 147000 }),
  expense({ date: '2026-09-03', category: 'wash', total: 100000, deleted: true }),
]

test('разбивка по группам: строки ТО + остаток без детализации', () => {
  const c = costBreakdown(records)
  expect(c.total).toBe(2322600)
  expect(c.byGroup).toEqual({ parts: 580000, labor: 300000, serviceOther: 365000, fuel: 227600, osago: 850000 })
  expect(c.byMonth.map((m) => [m.month, m.total])).toEqual([['2026-08', 1245000], ['2026-09', 1077600]])
})

test('период включает границы', () => {
  expect(costBreakdown(records, { from: '2026-09-01', to: '2026-09-01' }).total).toBe(227600)
})

test('пробег и цена км', () => {
  expect(kmDriven(records)).toBe(2000)
  expect(costPerKm(records)).toBeCloseTo(2322600 / 2000, 5)
  expect(kmDriven(records, { from: '2026-09-20' })).toBeNull() // одна точка
  expect(costPerKm(records, { from: '2026-09-20' })).toBeNull()
})

test('скидка: итог меньше суммы строк → отрицательный остаток', () => {
  const c = costBreakdown([service({ date: '2026-01-01', total: 90000, works: [{ id: 'w', name: 'Работа', price: 100000 }] })])
  expect(c.byGroup).toEqual({ labor: 100000, serviceOther: -10000 })
  expect(c.total).toBe(90000)
})
