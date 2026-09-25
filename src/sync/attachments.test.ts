// @vitest-environment node
// Среда node: у jsdom свой Blob, и fake-indexeddb (structuredClone Node) возвращает его пустым объектом.
// Нативные Blob/File Node переживают запись в IndexedDB так же, как в браузере.
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MyAutoDB } from '../db/schema'
import { FakeDisk } from './yandex/fakeDisk'
import { Offline } from './yandex/api'
import { createAttachmentStore, remotePaths } from './attachments'

let db: MyAutoDB, disk: FakeDisk
const compress = vi.fn(async (_f: Blob, maxSide: number) => ({ blob: new Blob([`jpeg${maxSide}`], { type: 'image/jpeg' }), width: maxSide, height: maxSide / 2 }))
const urls = vi.fn((b: Blob) => `blob:${b.size}`)
const store = (online = true) => createAttachmentStore({ db, getDisk: () => (online ? disk : null), compress, createObjectURL: urls })
const owner = { ownerType: 'record' as const, ownerId: 'r1' }
beforeEach(() => { db = new MyAutoDB(`t-${crypto.randomUUID()}`); disk = new FakeDisk() })
afterEach(async () => { await db.delete() })

test('фото сжимается до 2000 и 320 px и ждёт загрузки', async () => {
  const s = store()
  const att = await s.addFile(owner, new File(['raw'], 'check.jpg', { type: 'image/jpeg' }))
  expect(att).toMatchObject({ kind: 'photo', mime: 'image/jpeg', name: 'check.jpg', width: 2000, height: 1000, ownerId: 'r1' })
  expect(compress).toHaveBeenCalledWith(expect.any(File), 2000, 0.82)
  expect(compress).toHaveBeenCalledWith(expect.any(File), 320, 0.7)
  expect(await s.pendingCount()).toBe(2)
  expect(await s.getThumbUrl(att)).toMatch(/^blob:/)
})

test('PDF больше 20 МБ и неподдерживаемый тип — понятная ошибка', async () => {
  const s = store()
  const big = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'scan.pdf', { type: 'application/pdf' })
  await expect(s.addFile(owner, big)).rejects.toThrow('PDF больше 20 МБ — сожмите файл')
  await expect(s.addFile(owner, new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow('Можно прикрепить фото или PDF')
})

test('загрузка на Диск снимает pending и ставит uploadedAt', async () => {
  const s = store()
  const att = await s.addFile(owner, new File(['raw'], 'check.jpg', { type: 'image/jpeg' }))
  await s.uploadPending(disk)
  const { orig, thumb } = remotePaths(att)
  expect(orig).toBe(`app:/attachments/${att.id}.jpg`)
  expect(thumb).toBe(`app:/attachments/${att.id}.thumb.jpg`)
  expect(disk.files.has(orig)).toBe(true)
  expect(disk.files.has(thumb!)).toBe(true)
  expect(await s.pendingCount()).toBe(0)
  expect((await db.attachments.get(att.id))?.uploadedAt).toBeTypeOf('number')
})

test('на другом устройстве превью скачивается с Диска и кешируется', async () => {
  const s = store()
  const att = await s.addFile(owner, new File(['raw'], 'check.jpg', { type: 'image/jpeg' }))
  await s.uploadPending(disk)
  const uploaded = (await db.attachments.get(att.id))!
  const other = new MyAutoDB(`t-${crypto.randomUUID()}`)
  await other.attachments.put(uploaded)
  const s2 = createAttachmentStore({ db: other, getDisk: () => disk, compress, createObjectURL: urls })
  expect(await s2.getThumbUrl(uploaded)).toMatch(/^blob:/)
  expect(await other.blobs.get(`${att.id}:thumb`)).toMatchObject({ pending: 0 })
  await other.delete()
})

test('удалённое вложение чистится на Диске и локально', async () => {
  const s = store()
  const att = await s.addFile(owner, new File(['raw'], 'check.jpg', { type: 'image/jpeg' }))
  await s.uploadPending(disk)
  await s.remove((await db.attachments.get(att.id))!)
  await s.cleanupDeleted(disk)
  expect(disk.files.has(remotePaths(att).orig)).toBe(false)
  expect(await db.blobs.where('attachmentId').equals(att.id).count()).toBe(0)
})

test('кеш вытесняет старые загруженные оригиналы, но не неотправленные', async () => {
  const s = store()
  const a = await s.addFile(owner, new File(['1'], 'a.jpg', { type: 'image/jpeg' }))
  await s.uploadPending(disk)
  const b = await s.addFile(owner, new File(['2'], 'b.jpg', { type: 'image/jpeg' }))
  await s.evictCache(1) // лимит 1 байт
  expect(await db.blobs.get(`${a.id}:orig`)).toBeUndefined()   // загружен — можно вытеснить
  expect(await db.blobs.get(`${a.id}:thumb`)).toBeDefined()     // превью не вытесняются
  expect(await db.blobs.get(`${b.id}:orig`)).toBeDefined()      // не загружен — нельзя
})

test('фото без интернета: обрыв посреди загрузки — докачивается следующим циклом', async () => {
  const s = store(false)
  const att = await s.addFile(owner, new File(['raw'], 'check.jpg', { type: 'image/jpeg' }))
  expect(await s.pendingCount()).toBe(2)
  disk.failNext(new Offline('Нет связи с Яндекс.Диском', 0), { method: 'uploadBlob', times: 1 })
  await expect(s.uploadPending(disk)).rejects.toBeInstanceOf(Offline)
  expect(await s.pendingCount()).toBeGreaterThan(0)
  expect((await db.attachments.get(att.id))?.uploadedAt).toBeUndefined()
  await s.uploadPending(disk)
  expect(await s.pendingCount()).toBe(0)
  expect(disk.files.has(remotePaths(att).orig)).toBe(true)
  expect(disk.files.has(remotePaths(att).thumb!)).toBe(true)
  expect((await db.attachments.get(att.id))?.uploadedAt).toBeTypeOf('number')
})

test('вложение, удалённое до загрузки, на Диск не уходит и не считается ждущим', async () => {
  const s = store()
  const att = await s.addFile(owner, new File(['raw'], 'check.jpg', { type: 'image/jpeg' }))
  await s.remove(att)
  expect(await s.pendingCount()).toBe(0)
  await s.uploadPending(disk)
  expect(disk.calls.filter((c) => c.startsWith('uploadBlob'))).toEqual([])
  await s.cleanupDeleted(disk)
  expect(await db.blobs.where('attachmentId').equals(att.id).count()).toBe(0)
})
