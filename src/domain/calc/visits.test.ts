import { expect, test } from 'vitest'
import { masterSpend, placeSpend, visitStats } from './visits'
import { expense, note, odo, service } from './fixtures'

const P = 'pl'
const M = 'm'

test('место: запись у места — её итог; только «где купил» у запчастей — сумма этих строк', () => {
  expect(placeSpend(service({ placeId: P, total: 10000 }), P)).toBe(10000)
  expect(placeSpend(service({ total: 50000, parts: [
    { id: 'a', name: 'Масло', qty: 4.5, unit: 'l', unitPrice: 1111, ownPart: true, supplierPlaceId: P },
    { id: 'b', name: 'Фильтр', qty: 1, unit: 'pcs', unitPrice: 40000, ownPart: true },
  ] }), P)).toBe(5000)
  expect(placeSpend(expense({ placeId: P, total: 300 }), P)).toBe(300)
  expect(placeSpend(service({ placeId: 'other', total: 1 }), P)).toBeNull()
})

test('место: пробег и заметка с местом — не визит, удалённая запись — тоже', () => {
  expect(placeSpend(odo({ placeId: P, odometer: 1 }), P)).toBeNull()
  expect(placeSpend(note({ placeId: P }), P)).toBeNull()
  expect(placeSpend(service({ placeId: P, total: 5, deleted: true }), P)).toBeNull()
})

test('мастер: мастер записи — её итог; только мастер работы — сумма его работ', () => {
  expect(masterSpend(service({ masterId: M, total: 20000 }), M)).toBe(20000)
  expect(masterSpend(service({ masterId: 'x', total: 12000, works: [
    { id: 'w1', name: 'Замена', price: 5000, masterId: M }, { id: 'w2', name: 'Диагностика', price: 7000 },
  ] }), M)).toBe(5000)
  expect(masterSpend(service({ total: 1 }), M)).toBeNull()
})

test('сводка визитов', () => {
  const recs = [service({ date: '2026-02-01', placeId: P, total: 10000 }), service({ date: '2026-03-01', placeId: P, total: 5001 }),
    service({ date: '2026-04-01', total: 7 })]
  expect(visitStats(recs, (r) => placeSpend(r, P))).toEqual({ visits: 2, total: 15001, average: 7501, lastDate: '2026-03-01' })
  expect(visitStats([], (r) => placeSpend(r, P))).toEqual({ visits: 0, total: 0, average: 0 })
})
