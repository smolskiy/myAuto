import { expect, test } from 'vitest'
import { lineTotal } from './lines'

test('стоимость строки: запчасть — количество × цена с округлением до копейки, работа — цена', () => {
  expect(lineTotal({ id: 'p', name: 'Масло', qty: 4.5, unit: 'l', unitPrice: 1111, ownPart: true })).toBe(5000)
  expect(lineTotal({ id: 'p', name: 'Фильтр', qty: 2, unit: 'pcs', ownPart: true })).toBe(0)
  expect(lineTotal({ id: 'w', name: 'Замена', price: 30000 })).toBe(30000)
  expect(lineTotal({ id: 'w', name: 'Без цены' })).toBe(0)
})
