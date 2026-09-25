import { afterEach, expect, test, vi } from 'vitest'
import { MyAutoDB } from '../db/schema'
import { BUILTIN_CATALOG } from '../domain/catalog'
import type { Attachment, CarRecord, OwnerType, VehicleDocument } from '../domain/types'
import { initApp } from './init'

const db = new MyAutoDB(`t-${crypto.randomUUID()}`)
afterEach(async () => {
  await db.catalogItems.clear()
})

test('засевает каталог и запускает синхронизацию', async () => {
  const initSync = vi.fn(async () => {})
  await initApp({ db, initSync })
  expect(await db.catalogItems.count()).toBe(BUILTIN_CATALOG.length)
  expect(initSync).toHaveBeenCalledOnce()
})

test('сбой сида каталога не мешает запустить синхронизацию', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const broken = {
    catalogItems: {
      toCollection() {
        throw new Error('IndexedDB недоступна')
      },
    },
  } as unknown as MyAutoDB
  const initSync = vi.fn(async () => {})
  await expect(initApp({ db: broken, initSync })).resolves.toBeUndefined()
  expect(initSync).toHaveBeenCalledOnce()
  expect(warn).toHaveBeenCalled()
})

test('сбой синхронизации не ломает запуск', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  await expect(
    initApp({
      db,
      initSync: async () => {
        throw new Error('нет сети')
      },
    }),
  ).resolves.toBeUndefined()
})

test('при запуске убирает свои вложения без владельца старше суток — брошенные черновики форм', async () => {
  const HOUR = 60 * 60 * 1000
  const NOW = Date.UTC(2026, 8, 25, 12)
  const local = new MyAutoDB(`t-${crypto.randomUUID()}`)
  const att = (
    id: string,
    ownerType: OwnerType,
    ownerId: string,
    ageH: number,
    deleted?: boolean,
  ): Attachment => ({
    id,
    ownerType,
    ownerId,
    kind: 'photo',
    mime: 'image/jpeg',
    name: `${id}.jpg`,
    size: 1,
    createdAt: NOW - ageH * HOUR,
    updatedAt: NOW - ageH * HOUR,
    ...(deleted ? { deleted } : {}),
  })
  await local.records.bulkPut([
    { id: 'saved', vehicleId: 'v', kind: 'note', date: '2026-09-01', title: 'x', createdAt: 1, updatedAt: 1 },
    {
      id: 'binned',
      vehicleId: 'v',
      kind: 'note',
      date: '2026-09-01',
      title: 'x',
      createdAt: 1,
      updatedAt: 2,
      deleted: true,
    },
  ] as CarRecord[])
  await local.documents.put({
    id: 'doc',
    vehicleId: 'v',
    kind: 'sts',
    createdAt: 1,
    updatedAt: 1,
  } as VehicleDocument)
  const rows = [
    att('draft-old', 'record', 'never-saved', 25), // брошенный черновик записи — убрать
    att('draft-doc', 'document', 'never-saved-doc', 48), // брошенный черновик документа — убрать
    att('draft-fresh', 'record', 'never-saved', 1), // форма, может быть, ещё открыта — оставить
    att('owned', 'record', 'saved', 72), // владелец есть — оставить
    att('owner-binned', 'record', 'binned', 72), // владелец удалён мягко — «Отменить» вернёт вложения
    att('doc-owned', 'document', 'doc', 72), // владелец-документ есть — оставить
    att('already-deleted', 'record', 'never-saved', 72, true), // уже удалено — не трогать
    att('foreign', 'vehicle', 'not-pulled-yet', 72), // пришло с другого телефона, файлов здесь нет — не трогать
  ]
  await local.attachments.bulkPut(rows)
  // Файлы на устройстве — у всех, кроме пришедшего с другого телефона.
  await local.blobs.bulkPut(
    rows
      .filter((r) => r.id !== 'foreign')
      .map((r) => ({
        key: `${r.id}:thumb`,
        attachmentId: r.id,
        variant: 'thumb' as const,
        blob: new Blob(['x']),
        pending: 0 as const,
        size: 1,
        lastAccess: 0,
      })),
  )
  const remove = vi.fn(async (_a: Attachment) => {})
  const initSync = vi.fn(async () => {})

  await initApp({ db: local, initSync, attachments: { remove }, now: () => NOW })

  expect(remove.mock.calls.map(([a]) => a.id).sort()).toEqual(['draft-doc', 'draft-old'])
  expect(initSync).toHaveBeenCalledOnce()
  await local.delete()
})
