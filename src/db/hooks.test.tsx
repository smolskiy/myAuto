import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { db } from './instance'
import { repos } from './repos'
import { useActiveVehicle, useBrandSuggestions, useCatalog, useRecords, useUpcoming, useVehicles } from './hooks'
import { BUILTIN_CATALOG, CATALOG_ID } from '../domain/catalog'

beforeEach(async () => { await db.open() })
afterEach(async () => { await Promise.all(db.tables.map((t) => t.clear())) })

const newVehicle = (name: string, order: number, archived = false) => repos.vehicles.create({
  name, make: 'Skoda', model: 'Octavia', archived, fluids: [], order,
})

test('список машин живой и без архива', async () => {
  const { result } = renderHook(() => useVehicles())
  await waitFor(() => expect(result.current).toEqual([]))
  await act(async () => { await newVehicle('Октавия', 1); await newVehicle('Старая', 0, true) })
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

test('записи отсортированы и фильтруются по типу', async () => {
  const v = await newVehicle('A', 1)
  await repos.records.create({ vehicleId: v.id, kind: 'odometer', date: '2026-01-01', odometer: 10, total: 0 })
  await repos.records.create({ vehicleId: v.id, kind: 'fuel', date: '2026-02-01', odometer: 20, total: 100,
    liters: 1, pricePerLiter: 100, fullTank: true, missedBefore: false })
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
  await repos.records.create({ vehicleId: v.id, kind: 'service', date: '2026-01-15', total: 0,
    title: 'ТО', serviceType: 'maintenance', diy: false, works: [],
    parts: [{ id: 'p', name: 'Фильтр', brand: 'Sakura', qty: 1, unit: 'pcs', ownPart: true }] })
  const { result } = renderHook(() => useBrandSuggestions('', 3))
  await waitFor(() => expect(result.current).toEqual(['Sakura']))
})

test('«Скоро» собирает напоминания и сроки', async () => {
  const v = await newVehicle('A', 1)
  await repos.records.create({ vehicleId: v.id, kind: 'service', date: '2026-01-15', odometer: 140000, total: 0,
    title: 'ТО', serviceType: 'maintenance', diy: false, works: [],
    parts: [{ id: 'p', itemId: CATALOG_ID.engineOil, name: 'Масло', qty: 4, unit: 'l', ownPart: true }] })
  await repos.records.create({ vehicleId: v.id, kind: 'odometer', date: '2026-09-20', odometer: 149500, total: 0 })
  await repos.reminders.create({ vehicleId: v.id, itemId: CATALOG_ID.engineOil, intervalKm: 10000, intervalMonths: 12, enabled: true })
  await repos.documents.create({ vehicleId: v.id, kind: 'osago', validUntil: '2026-10-07' })
  const { result } = renderHook(() => useUpcoming(v.id, 3, '2026-09-25'))
  await waitFor(() => expect(result.current?.map((u) => [u.title, u.state])).toEqual([
    ['ОСАГО', 'soon'], ['Моторное масло', 'soon'],
  ]))
})
