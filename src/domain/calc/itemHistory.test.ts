import { expect, test } from 'vitest'
import { itemHistory, lastPartFor } from './itemHistory'
import { service } from './fixtures'

const F = 'item.oil_filter'
const recs = [
  service({
    id: 'a',
    date: '2025-09-01',
    odometer: 130000,
    placeId: 'pl1',
    parts: [
      {
        id: 'x',
        itemId: F,
        name: 'Фильтр',
        brand: 'Mahle',
        partNumber: 'OC 90',
        qty: 1,
        unit: 'pcs',
        unitPrice: 55000,
        ownPart: true,
      },
    ],
  }),
  service({
    id: 'b',
    date: '2026-06-01',
    odometer: 140000,
    parts: [
      {
        id: 'y',
        itemId: F,
        name: 'Фильтр',
        brand: 'Mann-Filter',
        partNumber: 'W 712/95',
        qty: 1,
        unit: 'pcs',
        unitPrice: 65000,
        ownPart: true,
      },
    ],
    works: [{ id: 'w', itemId: F, name: 'Замена фильтра', price: 20000 }],
  }),
]

test('история узла с интервалами', () => {
  const h = itemHistory(recs, F)
  expect(h.map((e) => [e.recordId, e.line, e.brand, e.sinceKm, e.sinceDays])).toEqual([
    ['b', 'part', 'Mann-Filter', 10000, 273],
    ['b', 'work', undefined, 10000, 273],
    ['a', 'part', 'Mahle', undefined, undefined],
  ])
})

test('подсказка «в прошлый раз»', () => {
  expect(lastPartFor(recs, F)).toMatchObject({
    recordId: 'b',
    date: '2026-06-01',
    line: { brand: 'Mann-Filter', partNumber: 'W 712/95', unitPrice: 65000 },
  })
  expect(lastPartFor(recs, 'item.none')).toBeNull()
})
