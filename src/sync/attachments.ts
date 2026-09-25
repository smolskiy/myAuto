import type { BlobRow, MyAutoDB } from '../db/schema'
import { createRepos } from '../db/repos'
import { getMeta, setMeta } from '../db/meta'
import { newId } from '../domain/ids'
import type { Attachment, ID } from '../domain/types'
import type { AttachmentStore } from './contracts'
import type { DiskClient } from './yandex/api'
import { compressImage } from './image'

/**
 * Фото и PDF (спецификация, раздел 6.3).
 *
 * Новое вложение — строка Attachment (синхронизируется через garage.json) и файлы в `blobs` с `pending: 1`.
 * Синхронизация загружает их на Диск и ставит `uploadedAt`. Превью остаются на устройстве, оригиналы —
 * в кеше до 200 МБ; неотправленный файл не вытесняется никогда. На другом устройстве превью и оригинал
 * скачиваются с Диска при первом показе.
 */

export const MAX_PDF_BYTES = 20 * 1024 * 1024
export const CACHE_LIMIT_BYTES = 200 * 1024 * 1024
/** Сколько файлы удалённого вложения ждут чистки: удаление можно отменить и получить файлы обратно. */
export const DELETE_GRACE_MS = 24 * 60 * 60 * 1000
export const ATTACHMENTS_DIR = 'app:/attachments'
/** id удалённых вложений, чьи файлы уже стёрты (на этом устройстве). */
const CLEANED_KEY = 'sync.cleanedAttachments'

const PHOTO = { maxSide: 2000, quality: 0.82 }
const THUMB = { maxSide: 320, quality: 0.7 }

export function remotePaths(att: Attachment): { orig: string; thumb?: string } {
  if (att.kind === 'pdf') return { orig: `${ATTACHMENTS_DIR}/${att.id}.pdf` }
  return { orig: `${ATTACHMENTS_DIR}/${att.id}.jpg`, thumb: `${ATTACHMENTS_DIR}/${att.id}.thumb.jpg` }
}

export interface AttachmentStoreDeps {
  db: MyAutoDB
  getDisk: () => DiskClient | null
  compress?: typeof compressImage
  createObjectURL?: (b: Blob) => string
  onChanged?: () => void
  now?: () => number
}

export type AttachmentService = AttachmentStore & {
  uploadPending(disk: DiskClient): Promise<void>
  cleanupDeleted(disk: DiskClient): Promise<void>
  evictCache(limitBytes?: number): Promise<void>
}

const isPdf = (file: File) => file.type === 'application/pdf' || (!file.type && /\.pdf$/i.test(file.name))

export function createAttachmentStore(deps: AttachmentStoreDeps): AttachmentService {
  const { db, getDisk } = deps
  const compress = deps.compress ?? compressImage
  const createObjectURL = deps.createObjectURL ?? ((b: Blob) => URL.createObjectURL(b))
  const now = deps.now ?? (() => Date.now())
  const repo = createRepos(db).attachments
  const changed = () => deps.onChanged?.()

  const blobRow = (attachmentId: ID, variant: BlobRow['variant'], blob: Blob, pending: 0 | 1): BlobRow => ({
    key: `${attachmentId}:${variant}`,
    attachmentId,
    variant,
    blob,
    pending,
    size: blob.size,
    lastAccess: now(),
  })

  async function save(
    draft: Omit<Attachment, 'createdAt' | 'updatedAt' | 'deleted'>,
    blobs: BlobRow[],
  ): Promise<Attachment> {
    const att = await db.transaction('rw', db.attachments, db.blobs, async () => {
      await db.blobs.bulkPut(blobs)
      return repo.create(draft)
    })
    changed()
    return att
  }

  async function getUrl(att: Attachment, variant: BlobRow['variant']): Promise<string | null> {
    const key = `${att.id}:${variant}`
    const local = await db.blobs.get(key)
    if (local) {
      await db.blobs.update(key, { lastAccess: now() })
      return createObjectURL(local.blob)
    }
    const disk = getDisk()
    const path = variant === 'orig' ? remotePaths(att).orig : remotePaths(att).thumb
    if (!att.uploadedAt || !disk || !path) return null
    let blob: Blob | null
    try {
      blob = await disk.downloadBlob(path)
    } catch (e) {
      console.warn('Файл вложения не скачался', e)
      return null
    }
    if (!blob) return null
    await db.blobs.put(blobRow(att.id, variant, blob, 0))
    if (variant === 'orig') await store.evictCache()
    return createObjectURL(blob)
  }

  /** Строки вложений, которые не удалены: только их файлы грузим на Диск и считаем ждущими. */
  async function aliveIds(ids: ID[]): Promise<Set<ID>> {
    const rows = await db.attachments.bulkGet([...new Set(ids)])
    return new Set(rows.filter((r): r is Attachment => !!r && !r.deleted).map((r) => r.id))
  }

  const store: AttachmentService = {
    async addFile(owner, file) {
      const id = newId()
      const base = { id, ownerType: owner.ownerType, ownerId: owner.ownerId, name: file.name }
      if (isPdf(file)) {
        if (file.size > MAX_PDF_BYTES) throw new Error('PDF больше 20 МБ — сожмите файл')
        return save({ ...base, kind: 'pdf', mime: 'application/pdf', size: file.size }, [
          blobRow(id, 'orig', file, 1),
        ])
      }
      if (!file.type.startsWith('image/')) throw new Error('Можно прикрепить фото или PDF')
      let photo, thumb
      try {
        photo = await compress(file, PHOTO.maxSide, PHOTO.quality)
        thumb = await compress(file, THUMB.maxSide, THUMB.quality)
      } catch (e) {
        console.warn('Фото не сжалось', e)
        throw new Error('Не удалось прочитать фото — попробуйте другой снимок', { cause: e })
      }
      return save(
        {
          ...base,
          kind: 'photo',
          mime: 'image/jpeg',
          size: photo.blob.size,
          width: photo.width,
          height: photo.height,
        },
        [blobRow(id, 'orig', photo.blob, 1), blobRow(id, 'thumb', thumb.blob, 1)],
      )
    },

    getThumbUrl: (att) => (att.kind === 'photo' ? getUrl(att, 'thumb') : Promise.resolve(null)),

    getOriginalUrl: (att) => getUrl(att, 'orig'),

    async remove(att) {
      await repo.remove(att.id)
      changed()
    },

    async pendingCount() {
      const pending = await db.blobs.where('pending').equals(1).toArray()
      if (pending.length === 0) return 0
      const alive = await aliveIds(pending.map((b) => b.attachmentId))
      return pending.filter((b) => alive.has(b.attachmentId)).length
    },

    /** По вложению за раз: обрыв связи оставляет недогруженные файлы pending до следующего цикла. */
    async uploadPending(disk) {
      const pending = await db.blobs.where('pending').equals(1).toArray()
      if (pending.length === 0) return
      const alive = await aliveIds(pending.map((b) => b.attachmentId))
      const byAttachment = new Map<ID, BlobRow[]>()
      for (const row of pending) {
        if (!alive.has(row.attachmentId)) continue
        byAttachment.set(row.attachmentId, [...(byAttachment.get(row.attachmentId) ?? []), row])
      }
      if (byAttachment.size === 0) return
      await disk.ensureFolder(ATTACHMENTS_DIR)
      for (const [id, rows] of byAttachment) {
        const att = await db.attachments.get(id)
        if (!att || att.deleted) continue // удалили, пока грузились предыдущие
        const paths = remotePaths(att)
        for (const row of rows) {
          const path = row.variant === 'orig' ? paths.orig : paths.thumb
          if (!path) continue
          await disk.uploadBlob(path, row.blob, row.variant === 'thumb' ? 'image/jpeg' : att.mime)
          await db.blobs.update(row.key, { pending: 0 })
        }
        // Проверка и правка — одной транзакцией: строку могли удалить, пока грузились её файлы.
        // Удалили — файлы снова ждут загрузки: «Отменить» вернёт строку, и следующий цикл поставит uploadedAt.
        await db.transaction('rw', db.attachments, db.blobs, async () => {
          const current = await db.attachments.get(id)
          if (current && !current.deleted) await repo.update(id, { uploadedAt: now() })
          else if (current) await db.blobs.where('attachmentId').equals(id).modify({ pending: 1 })
        })
        changed()
      }
      await store.evictCache()
    },

    /**
     * Файлы удалённых вложений стираются с Диска (404 — не ошибка) и с устройства, один раз на устройство,
     * но не раньше чем через сутки после удаления: пока удаление можно отменить, файлы (и неотправленные
     * оригиналы) остаются на месте. Удаляем и без `uploadedAt`: пометка о загрузке могла проиграть
     * слиянию удалению с другого телефона.
     */
    async cleanupDeleted(disk) {
      const cutoff = now() - DELETE_GRACE_MS
      const deleted = await db.attachments.filter((a) => !!a.deleted && a.updatedAt < cutoff).toArray()
      if (deleted.length === 0) return
      const cleaned = new Set(await getMeta<ID[]>(db, CLEANED_KEY, []))
      const todo = deleted.filter((a) => !cleaned.has(a.id))
      for (const att of todo) {
        const { orig, thumb } = remotePaths(att)
        await disk.remove(orig)
        if (thumb) await disk.remove(thumb)
        await db.blobs.where('attachmentId').equals(att.id).delete()
        cleaned.add(att.id)
        await setMeta(db, CLEANED_KEY, [...cleaned])
      }
      if (todo.length > 0) changed()
    },

    /** Вытесняет только загруженные оригиналы, самые давние по показу, пока кеш больше лимита. */
    async evictCache(limitBytes = CACHE_LIMIT_BYTES) {
      const all = await db.blobs.toArray()
      let total = all.reduce((sum, b) => sum + b.size, 0)
      if (total <= limitBytes) return
      const candidates = all
        .filter((b) => b.variant === 'orig' && b.pending === 0)
        .sort((a, b) => a.lastAccess - b.lastAccess)
      for (const b of candidates) {
        if (total <= limitBytes) break
        await db.blobs.delete(b.key)
        total -= b.size
      }
    },
  }
  return store
}
