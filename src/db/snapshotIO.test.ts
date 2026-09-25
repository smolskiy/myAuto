import { afterEach, beforeEach, expect, test } from 'vitest'
import { MyAutoDB } from './schema'
import { applyRows, readSnapshot, replaceAll } from './snapshotIO'
import { subscribeLocalChanges } from './changes'
import { emptySnapshot } from '../domain/snapshot'

let db: MyAutoDB
beforeEach(() => {
  db = new MyAutoDB(`t-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await db.delete()
})

const place = { id: 'p1', createdAt: 1, updatedAt: 1, kind: 'service' as const, name: 'СТО', deleted: true }

test('снимок включает удалённые строки', async () => {
  await db.places.put(place)
  expect((await readSnapshot(db, 7)).tables.places).toEqual([place])
  expect((await readSnapshot(db, 7)).exportedAt).toBe(7)
})

test('применение строк с Диска не считается локальным изменением', async () => {
  const seen: string[] = []
  const off = subscribeLocalChanges((t) => seen.push(t))
  await applyRows(db, { places: [place] })
  off()
  expect(seen).toEqual([])
  expect(await db.places.get('p1')).toEqual(place)
})

test('applyRows не откатывает более новую локальную строку', async () => {
  const current = { id: 'p1', createdAt: 1, updatedAt: 10, kind: 'service' as const, name: 'СТО новое' }
  await db.places.put(current)
  await applyRows(db, { places: [{ ...current, updatedAt: 5, name: 'СТО старое' }] })
  const row = await db.places.get('p1')
  expect(row!.updatedAt).toBe(10)
  expect(row!.name).toBe('СТО новое')
})

test('полная замена сохраняет blobs и meta', async () => {
  await db.places.put({ ...place, id: 'old', deleted: false })
  await db.meta.put({ key: 'theme', value: 'dark' })
  const blobRow = {
    key: 'att1:orig',
    attachmentId: 'att1',
    variant: 'orig' as const,
    blob: new Blob(['x']),
    pending: 1 as const,
    size: 1,
    lastAccess: 1,
  }
  await db.blobs.put(blobRow)
  await replaceAll(db, { ...emptySnapshot(), tables: { ...emptySnapshot().tables, places: [place] } })
  expect(await db.places.toArray()).toEqual([place])
  expect(await db.meta.get('theme')).toEqual({ key: 'theme', value: 'dark' })
  const storedBlob = await db.blobs.get('att1:orig')
  expect(storedBlob).toMatchObject({
    key: 'att1:orig',
    attachmentId: 'att1',
    variant: 'orig',
    pending: 1,
    size: 1,
    lastAccess: 1,
  })
  expect(storedBlob?.blob).toBeTruthy()
})
