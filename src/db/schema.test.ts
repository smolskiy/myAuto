import { afterEach, expect, test } from 'vitest'
import { MyAutoDB, SYNC_TABLES } from './schema'
import { TABLE_NAMES } from '../domain/snapshot'

let db: MyAutoDB | undefined
afterEach(async () => {
  await db?.delete()
})

test('в базе есть все таблицы снимка плюс локальные blobs и meta', async () => {
  db = new MyAutoDB(`t-${crypto.randomUUID()}`)
  await db.open()
  const names = db.tables.map((t) => t.name).sort()
  expect(names).toEqual([...TABLE_NAMES, 'blobs', 'meta'].sort())
  expect([...SYNC_TABLES].sort()).toEqual([...TABLE_NAMES].sort())
})

test('записи ищутся по машине и дате через составной индекс', async () => {
  db = new MyAutoDB(`t-${crypto.randomUUID()}`)
  const base = { createdAt: 1, updatedAt: 1, total: 0, kind: 'odometer' as const }
  await db.records.bulkPut([
    { ...base, id: 'a', vehicleId: 'v1', date: '2026-01-02', odometer: 100 },
    { ...base, id: 'b', vehicleId: 'v1', date: '2026-03-01', odometer: 300 },
    { ...base, id: 'c', vehicleId: 'v2', date: '2026-02-01', odometer: 200 },
  ])
  const rows = await db.records
    .where('[vehicleId+date]')
    .between(['v1', '2026-01-01'], ['v1', '2026-12-31'])
    .toArray()
  expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
})
