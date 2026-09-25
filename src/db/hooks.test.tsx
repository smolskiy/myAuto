import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { db } from './instance'
import { repos } from './repos'
import {
  useActiveVehicle,
  useBrandSuggestions,
  useCatalog,
  useCostBreakdown,
  useDeadlines,
  useFuelStats,
  useMasterStats,
  usePlaceStats,
  useRecord,
  useRecords,
  useTireSetMileage,
  useUpcoming,
  useVehicles,
} from './hooks'
import { BUILTIN_CATALOG, CATALOG_ID } from '../domain/catalog'
import type { PartLine, ServiceRecord } from '../domain/types'

beforeEach(async () => {
  await db.open()
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const newVehicle = (name: string, order: number, archived = false) =>
  repos.vehicles.create({
    name,
    make: 'Skoda',
    model: 'Octavia',
    archived,
    fluids: [],
    order,
  })

test('список машин живой и без архива', async () => {
  const { result } = renderHook(() => useVehicles())
  await waitFor(() => expect(result.current).toEqual([]))
  await act(async () => {
    await newVehicle('Октавия', 1)
    await newVehicle('Старая', 0, true)
  })
  await waitFor(() => expect(result.current?.map((v) => v.name)).toEqual(['Октавия']))
})

test('активная машина: по умолчанию первая неархивная, потом выбранная', async () => {
  const a = await newVehicle('A', 2)
  const b = await newVehicle('B', 1)
  const { result } = renderHook(() => useActiveVehicle())
  await waitFor(() => expect(result.current.vehicle?.id).toBe(b.id))
  await act(() => result.current.setActive(a.id))
  await waitFor(() => expect(result.current.vehicle?.id).toBe(a.id))
})

test('архивная или удалённая машина активной не бывает: берётся первая неархивная, нет таких — null', async () => {
  const sold = await newVehicle('Проданная', 0, true)
  const b = await newVehicle('B', 2)
  const a = await newVehicle('A', 1)
  const { result } = renderHook(() => useActiveVehicle())
  await act(() => result.current.setActive(sold.id))
  await waitFor(() => expect(result.current.vehicle?.id).toBe(a.id))

  await act(() => result.current.setActive(b.id))
  await waitFor(() => expect(result.current.vehicle?.id).toBe(b.id))
  await act(() => repos.vehicles.update(b.id, { archived: true }))
  await waitFor(() => expect(result.current.vehicle?.id).toBe(a.id))

  await act(() => result.current.setActive(a.id))
  await act(() => repos.vehicles.remove(a.id))
  await waitFor(() => expect(result.current.vehicle).toBeNull())
})

test('записи отсортированы и фильтруются по типу', async () => {
  const v = await newVehicle('A', 1)
  await repos.records.create({
    vehicleId: v.id,
    kind: 'odometer',
    date: '2026-01-01',
    odometer: 10,
    total: 0,
  })
  await repos.records.create({
    vehicleId: v.id,
    kind: 'fuel',
    date: '2026-02-01',
    odometer: 20,
    total: 100,
    liters: 1,
    pricePerLiter: 100,
    fullTank: true,
    missedBefore: false,
  })
  const { result } = renderHook(() => useRecords(v.id, { kinds: ['fuel', 'odometer'] }))
  await waitFor(() => expect(result.current?.map((r) => r.kind)).toEqual(['fuel', 'odometer']))
  const only = renderHook(() => useRecords(v.id, { kinds: ['odometer'] }))
  await waitFor(() => expect(only.result.current?.map((r) => r.kind)).toEqual(['odometer']))
})

test('каталог: встроенные позиции без сида, удалённая встроенная не воскресает', async () => {
  await db.catalogItems.put({ ...BUILTIN_CATALOG[0]!, deleted: true, updatedAt: 5 })
  const { result } = renderHook(() => useCatalog())
  await waitFor(() => expect(result.current).toHaveLength(BUILTIN_CATALOG.length - 1))
  expect(result.current?.some((i) => i.id === BUILTIN_CATALOG[0]!.id)).toBe(false)
})

test('подсказки бренда из своей истории', async () => {
  const v = await newVehicle('A', 1)
  await repos.records.create({
    vehicleId: v.id,
    kind: 'service',
    date: '2026-01-15',
    total: 0,
    title: 'ТО',
    serviceType: 'maintenance',
    diy: false,
    works: [],
    parts: [{ id: 'p', name: 'Фильтр', brand: 'Sakura', qty: 1, unit: 'pcs', ownPart: true }],
  })
  const { result } = renderHook(() => useBrandSuggestions('', 3))
  await waitFor(() => expect(result.current).toEqual(['Sakura']))
})

test('«Скоро» собирает напоминания и сроки', async () => {
  const v = await newVehicle('A', 1)
  await repos.records.create({
    vehicleId: v.id,
    kind: 'service',
    date: '2026-01-15',
    odometer: 140000,
    total: 0,
    title: 'ТО',
    serviceType: 'maintenance',
    diy: false,
    works: [],
    parts: [{ id: 'p', itemId: CATALOG_ID.engineOil, name: 'Масло', qty: 4, unit: 'l', ownPart: true }],
  })
  await repos.records.create({
    vehicleId: v.id,
    kind: 'odometer',
    date: '2026-09-20',
    odometer: 149500,
    total: 0,
  })
  await repos.reminders.create({
    vehicleId: v.id,
    itemId: CATALOG_ID.engineOil,
    intervalKm: 10000,
    intervalMonths: 12,
    enabled: true,
  })
  await repos.documents.create({ vehicleId: v.id, kind: 'osago', validUntil: '2026-10-07' })
  const { result } = renderHook(() => useUpcoming(v.id, 3, '2026-09-25'))
  await waitFor(() =>
    expect(result.current?.map((u) => [u.title, u.state])).toEqual([
      ['ОСАГО', 'soon'],
      ['Моторное масло', 'soon'],
    ]),
  )
})

// ——— Fix round 1: записи всех машин, статистика мест и мастеров, покрытие хуков ———

type ServiceDraft = Partial<Omit<ServiceRecord, 'id' | 'createdAt' | 'updatedAt' | 'kind' | 'vehicleId'>>
const svc = (vehicleId: string, p: ServiceDraft = {}) =>
  repos.records.create({
    vehicleId,
    kind: 'service',
    date: '2026-01-01',
    total: 0,
    title: 'ТО',
    serviceType: 'maintenance',
    diy: false,
    works: [],
    parts: [],
    ...p,
  })
const part = (p: Partial<PartLine> = {}): PartLine => ({
  id: crypto.randomUUID(),
  name: 'Фильтр',
  qty: 1,
  unit: 'pcs',
  ownPart: true,
  ...p,
})

async function placeFixture() {
  const a = await newVehicle('A', 1)
  const b = await newVehicle('B', 2)
  const gone = await newVehicle('Удалённая', 3)
  const place = await repos.places.create({ kind: 'service', name: 'СТО' })
  const atPlace = await svc(a.id, { date: '2026-03-01', placeId: place.id, total: 10000 })
  const supplierOnly = await svc(b.id, {
    date: '2026-04-01',
    total: 50000,
    parts: [part({ qty: 2, unitPrice: 1500, supplierPlaceId: place.id }), part({ unitPrice: 40000 })],
  })
  await repos.records.create({
    vehicleId: a.id,
    kind: 'odometer',
    date: '2026-05-01',
    odometer: 1000,
    total: 0,
    placeId: place.id,
  })
  await repos.records.create({
    vehicleId: a.id,
    kind: 'note',
    date: '2026-05-02',
    title: 'Стук',
    total: 0,
    placeId: place.id,
  })
  await svc(a.id, { date: '2026-06-01', total: 7000 })
  await svc(gone.id, { date: '2026-07-01', placeId: place.id, total: 99900 })
  await repos.vehicles.remove(gone.id)
  return { place, atPlace, supplierOnly }
}

test('записи всех машин по месту: место записи или «где купил» у запчасти, только визиты', async () => {
  const { place, atPlace, supplierOnly } = await placeFixture()
  const { result } = renderHook(() => useRecords('all', { placeId: place.id }))
  await waitFor(() => expect(result.current?.map((r) => r.id)).toEqual([supplierOnly.id, atPlace.id]))
})

test('статистика места: визиты те же, у «где купил» — сумма его строк', async () => {
  const { place } = await placeFixture()
  const { result } = renderHook(() => usePlaceStats(place.id))
  await waitFor(() =>
    expect(result.current).toEqual({ visits: 2, total: 13000, average: 6500, lastDate: '2026-04-01' }),
  )
})

test('статистика мастера: мастер записи — итог записи, мастер работы — сумма его работ', async () => {
  const v = await newVehicle('A', 1)
  const m = await repos.masters.create({ name: 'Сергей' })
  const other = await repos.masters.create({ name: 'Иван' })
  await svc(v.id, { date: '2026-02-01', masterId: m.id, total: 20000 })
  await svc(v.id, {
    date: '2026-03-01',
    masterId: other.id,
    total: 12000,
    works: [
      { id: 'w1', name: 'Замена', price: 5000, masterId: m.id },
      { id: 'w2', name: 'Диагностика', price: 7000 },
    ],
  })
  const { result } = renderHook(() => useMasterStats(m.id))
  await waitFor(() =>
    expect(result.current).toEqual({ visits: 2, total: 25000, average: 12500, lastDate: '2026-03-01' }),
  )
})

test('без машины список записей ждёт (undefined)', async () => {
  const v = await newVehicle('A', 1)
  await svc(v.id)
  const { result } = renderHook(() => useRecords(undefined))
  await new Promise((r) => setTimeout(r, 50))
  expect(result.current).toBeUndefined()
})

test('хук по id: undefined во время загрузки, затем null для несуществующего', async () => {
  const { result } = renderHook(() => useRecord('missing'))
  expect(result.current).toBeUndefined()
  await waitFor(() => expect(result.current).toBeNull())
})

test('стоимость владения обновляется после записи через репозиторий', async () => {
  const v = await newVehicle('A', 1)
  const { result } = renderHook(() => useCostBreakdown(v.id))
  await waitFor(() => expect(result.current?.total).toBe(0))
  await act(async () => {
    await repos.records.create({
      vehicleId: v.id,
      kind: 'expense',
      date: '2026-02-01',
      category: 'wash',
      total: 100000,
    })
  })
  await waitFor(() => expect(result.current?.byGroup).toEqual({ wash: 100000 }))
})

test('сроки документов', async () => {
  const v = await newVehicle('A', 1)
  await repos.documents.create({ vehicleId: v.id, kind: 'osago', validUntil: '2026-10-07' })
  const { result } = renderHook(() => useDeadlines(v.id, '2026-09-25'))
  await waitFor(() =>
    expect(result.current?.map((d) => [d.title, d.state, d.remainingDays])).toEqual([['ОСАГО', 'soon', 12]]),
  )
})

test('статистика топлива за период', async () => {
  const v = await newVehicle('A', 1)
  const fill = (date: string, odometer: number, liters: number) =>
    repos.records.create({
      vehicleId: v.id,
      kind: 'fuel',
      date,
      odometer,
      liters,
      pricePerLiter: 5000,
      total: liters * 5000,
      fullTank: true,
      missedBefore: false,
    })
  await fill('2026-01-01', 1000, 40)
  await fill('2026-01-10', 1500, 30)
  await fill('2026-02-10', 2000, 40)
  const { result } = renderHook(() => useFuelStats(v.id, { from: '2026-02-01' }))
  await waitFor(() => expect(result.current?.intervals.map((i) => [i.km, i.liters])).toEqual([[500, 40]]))
  expect(result.current?.average).toBeCloseTo(8, 5)
})

test('пробег комплекта шин до текущего пробега машины', async () => {
  const v = await newVehicle('A', 1)
  const set = await repos.tireSets.create({
    vehicleId: v.id,
    season: 'winter',
    count: 4,
    status: 'installed',
  })
  await svc(v.id, {
    date: '2025-11-01',
    odometer: 100000,
    serviceType: 'tires',
    tireSwap: { mountedSetId: set.id },
  })
  await repos.records.create({
    vehicleId: v.id,
    kind: 'odometer',
    date: '2026-01-10',
    odometer: 103500,
    total: 0,
  })
  const { result } = renderHook(() => useTireSetMileage(set.id))
  await waitFor(() => expect(result.current).toBe(3500))
})
