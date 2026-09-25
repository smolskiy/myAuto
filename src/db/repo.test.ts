import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MyAutoDB } from './schema'
import { createRepos } from './repos'
import { subscribeLocalChanges } from './changes'
import { ensureSeed } from './seed'
import type { CatalogItem, Place } from '../domain/types'

const CATALOG: CatalogItem[] = ['a', 'b', 'c'].map((k) => ({
  id: `item.${k}`, createdAt: 0, updatedAt: 0, name: k, group: 'other', builtin: true,
}))

let db: MyAutoDB
beforeEach(() => { db = new MyAutoDB(`t-${crypto.randomUUID()}`) })
afterEach(async () => { await db.delete() })

test('создание, правка, мягкое удаление и восстановление', async () => {
  const { places } = createRepos(db)
  const created = await places.create({ kind: 'service', name: 'Автосервис' })
  expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
  expect(created.createdAt).toBe(created.updatedAt)
  const updated = await places.update(created.id, { name: 'Автосервис №1' })
  expect(updated.updatedAt).toBeGreaterThan(created.updatedAt)
  await places.remove(created.id)
  expect(await places.get(created.id)).toBeUndefined()
  expect(await places.list()).toEqual([])
  expect((await db.places.get(created.id))?.deleted).toBe(true)
  await places.restore(created.id)
  expect((await places.get(created.id))?.name).toBe('Автосервис №1')
})

test('updatedAt строго растёт даже при одинаковом Date.now()', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
  const { places } = createRepos(db)
  const a = await places.create({ kind: 'fuel', name: 'АЗС' })
  const b = await places.update(a.id, { name: 'АЗС 2' })
  const c = await places.update(a.id, { name: 'АЗС 3' })
  expect(b.updatedAt).toBeGreaterThan(a.updatedAt)
  expect(c.updatedAt).toBeGreaterThan(b.updatedAt)
})

test('правка отсутствующей записи — ошибка', async () => {
  await expect(createRepos(db).places.update('nope', { name: 'x' } as Partial<Place>)).rejects.toThrow('Запись не найдена')
})

test('каждая правка сообщает о локальном изменении', async () => {
  const seen: string[] = []
  const off = subscribeLocalChanges((t) => seen.push(t))
  const { masters } = createRepos(db)
  const m = await masters.create({ name: 'Иван' })
  await masters.remove(m.id)
  off()
  expect(seen).toEqual(['masters', 'masters'])
})

test('повтор записи — копия с новыми id строк и без пробега', async () => {
  const { records } = createRepos(db)
  const src = await records.create({ vehicleId: 'v1', kind: 'service', date: '2026-01-01', odometer: 1000, total: 500,
    title: 'ТО', serviceType: 'maintenance', diy: false, works: [{ id: 'w1', name: 'Работа' }], parts: [] })
  const copy = await records.duplicate(src.id, '2026-09-25')
  expect(copy.id).not.toBe(src.id)
  expect(copy).toMatchObject({ date: '2026-09-25', total: 500, title: 'ТО' })
  expect(copy.odometer).toBeUndefined()
  expect(copy.kind === 'service' && copy.works[0]!.id).not.toBe('w1')
})

test('сид добавляет каталог один раз и не воскрешает удалённое', async () => {
  await ensureSeed(db, CATALOG)
  expect(await db.catalogItems.count()).toBe(3)
  await createRepos(db).catalog.remove('item.a')
  await ensureSeed(db, CATALOG)
  expect((await db.catalogItems.get('item.a'))?.deleted).toBe(true)
  expect(await db.catalogItems.count()).toBe(3)
})
