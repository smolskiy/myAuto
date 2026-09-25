import { describe, expect, test } from 'vitest'
import { BUILTIN_CATALOG, CATALOG_ID as C } from '../catalog'
import type { PartLine, WorkLine } from '../types'
import { expense, fuel, service } from './fixtures'
import { partsStats, serviceStats } from './garageStats'

const work = (name: string, price: number, p: Partial<WorkLine> = {}): WorkLine => ({
  id: `w-${name}-${price}`,
  name,
  price,
  ...p,
})
const part = (name: string, unitPrice: number, p: Partial<PartLine> = {}): PartLine => ({
  id: `p-${name}-${unitPrice}`,
  name,
  qty: 1,
  unit: 'pcs',
  unitPrice,
  ownPart: false,
  ...p,
})

describe('сервис', () => {
  const records = [
    service({
      date: '2026-03-10',
      placeId: 'sto',
      masterId: 'sergey',
      total: 1_500_000,
      works: [work('Замена масла', 200_000), work('Замена колодок', 300_000, { masterId: 'andrey' })],
      parts: [part('Масло', 800_000), part('Колодки', 150_000)],
    }),
    service({
      date: '2026-05-02',
      placeId: 'sto',
      masterId: 'sergey',
      total: 500_000,
      works: [work('Диагностика', 500_000)],
    }),
    service({
      date: '2026-05-20',
      diy: true,
      total: 300_000,
      parts: [part('Фильтр', 300_000, { ownPart: true })],
    }),
    service({ date: '2026-06-01', placeId: 'tire', total: 250_000, works: [work('Шиномонтаж', 250_000)] }),
    fuel({ date: '2026-05-01', placeId: 'azs', total: 400_000 }),
    expense({ date: '2026-05-01', placeId: 'sto', total: 99_900 }),
    service({ date: '2025-12-31', placeId: 'sto', total: 1_000_000 }),
    service({ date: '2026-04-01', placeId: 'sto', total: 7_000, deleted: true }),
  ]
  const s = serviceStats(records, { from: '2026-01-01', to: '2026-12-31' })

  test('итоги: работы, запчасти, прочее (итог записи — истина), визиты', () => {
    expect(s).toMatchObject({
      total: 2_550_000,
      labor: 1_250_000,
      parts: 1_250_000,
      other: 50_000,
      visits: 4,
    })
  })

  test('места по убыванию суммы; «делал сам» — отдельной строкой; заправки и расходы не в счёт', () => {
    expect(s.byPlace).toEqual([
      {
        key: 'sto',
        placeId: 'sto',
        diy: false,
        total: 2_000_000,
        labor: 1_000_000,
        parts: 950_000,
        visits: 2,
        lastDate: '2026-05-02',
      },
      { key: 'diy', diy: true, total: 300_000, labor: 0, parts: 300_000, visits: 1, lastDate: '2026-05-20' },
      {
        key: 'tire',
        placeId: 'tire',
        diy: false,
        total: 250_000,
        labor: 250_000,
        parts: 0,
        visits: 1,
        lastDate: '2026-06-01',
      },
    ])
  })

  test('мастера: мастер записи — её итог, мастер отдельной работы — сумма его работ', () => {
    expect(s.byMaster).toEqual([
      { masterId: 'sergey', total: 2_000_000, visits: 2, lastDate: '2026-05-02' },
      { masterId: 'andrey', total: 300_000, visits: 1, lastDate: '2026-03-10' },
    ])
  })

  test('по месяцам — работы, запчасти и прочее', () => {
    expect(s.byMonth).toEqual([
      { month: '2026-03', labor: 500_000, parts: 950_000, other: 50_000 },
      { month: '2026-05', labor: 500_000, parts: 300_000, other: 0 },
      { month: '2026-06', labor: 250_000, parts: 0, other: 0 },
    ])
  })
})

describe('запчасти', () => {
  const records = [
    service({
      date: '2025-06-01',
      odometer: 120_000,
      parts: [
        part('Масло 5W-30', 90_000, {
          itemId: C.engineOil,
          brand: 'Motul',
          qty: 4,
          unit: 'l',
          ownPart: true,
          supplierPlaceId: 'exist',
        }),
      ],
      works: [work('Замена масла', 150_000, { itemId: C.engineOil })],
    }),
    service({
      date: '2026-01-10',
      odometer: 130_000,
      parts: [
        part('Масло', 100_000, {
          itemId: C.engineOil,
          brand: 'motul',
          qty: 4,
          unit: 'l',
          ownPart: true,
          supplierPlaceId: 'exist',
        }),
        part('Фильтр', 65_000, { itemId: C.oilFilter, brand: 'Mann-Filter', ownPart: true }),
      ],
    }),
    service({
      date: '2026-07-01',
      odometer: 139_600,
      parts: [
        part('Масло', 110_000, { itemId: C.engineOil, brand: 'Shell', qty: 4, unit: 'l' }),
        part('Прокладка', 20_000),
      ],
    }),
  ]
  const s = partsStats(records, {}, BUILTIN_CATALOG)

  test('итоги: всего, свои и сервиса', () => {
    expect(s).toMatchObject({ total: 1_285_000, own: 825_000, service: 460_000 })
  })

  test('узлы: запчасти и работы по узлу, замены, бренды, средний пробег между заменами', () => {
    expect(s.byItem[0]).toEqual({
      key: C.engineOil,
      itemId: C.engineOil,
      name: 'Моторное масло',
      total: 1_350_000,
      replacements: 3,
      brands: ['Motul', 'Shell'],
      avgKmBetween: 9_800,
      lastDate: '2026-07-01',
    })
    expect(s.byItem.find((i) => i.name === 'Прокладка')).toMatchObject({
      key: 'name:прокладка',
      total: 20_000,
      replacements: 1,
      avgKmBetween: null,
    })
  })

  test('бренды без учёта регистра — написание, что встречается чаще', () => {
    expect(s.byBrand).toEqual([
      { brand: 'Motul', lines: 2, total: 760_000 },
      { brand: 'Shell', lines: 1, total: 440_000 },
      { brand: 'Mann-Filter', lines: 1, total: 65_000 },
    ])
  })

  test('где покупал: магазин, «купил сам» без магазина, запчасти сервиса', () => {
    expect(s.bySupplier).toEqual([
      { key: 'exist', placeId: 'exist', total: 760_000, purchases: 2 },
      { key: 'service', total: 460_000, purchases: 1 },
      { key: 'own', total: 65_000, purchases: 1 },
    ])
  })

  test('период ограничивает строки', () => {
    expect(partsStats(records, { from: '2026-01-01' }, BUILTIN_CATALOG).total).toBe(925_000)
  })
})

test('бренды узла — частые первыми, даже если редкий встретился раньше', () => {
  const oil = (brand: string, date: string) =>
    service({ date, parts: [part('Масло', 100, { itemId: C.engineOil, brand, id: `p-${date}` })] })
  const s = partsStats(
    [oil('Shell', '2026-01-01'), oil('Motul', '2026-02-01'), oil('Motul', '2026-03-01')],
    {},
    BUILTIN_CATALOG,
  )
  expect(s.byItem[0]?.brands).toEqual(['Motul', 'Shell'])
})
