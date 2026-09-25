import { db as appDb } from '../db/instance'
import type { MyAutoDB } from '../db/schema'
import { ensureSeed } from '../db/seed'
import { BUILTIN_CATALOG } from '../domain/catalog'
import type { OwnerType } from '../domain/types'
import type { AttachmentStore } from '../sync/contracts'
import { attachmentStore, initSync as appInitSync } from '../sync/index'

export interface InitDeps {
  db?: MyAutoDB
  initSync?: () => Promise<void>
  attachments?: Pick<AttachmentStore, 'remove'>
  now?: () => number
}

/** Сколько живёт вложение без строки-владельца: форма с черновиком могла быть открыта всё это время. */
export const ORPHAN_ATTACHMENT_MS = 24 * 60 * 60 * 1000

const OWNER_TABLE = {
  record: 'records',
  vehicle: 'vehicles',
  document: 'documents',
  tireSet: 'tireSets',
} as const satisfies Record<OwnerType, string>

/**
 * Черновые вложения, чья форма так и не сохранилась (приложение закрыли, не выйдя из формы), мягко удаляются
 * через сутки. Трогаем только вложения, добавленные на этом устройстве (их файлы лежат здесь): вложение,
 * пришедшее с другого телефона раньше своего владельца, удалять нельзя — удаление победило бы при слиянии.
 * Мягко удалённый владелец — не повод: «Отменить» должен вернуть запись вместе с фото.
 */
async function sweepOrphanAttachments(
  db: MyAutoDB,
  attachments: Pick<AttachmentStore, 'remove'>,
  now: number,
): Promise<void> {
  const cutoff = now - ORPHAN_ATTACHMENT_MS
  const stale = await db.attachments.filter((a) => !a.deleted && a.createdAt < cutoff).toArray()
  for (const att of stale) {
    if (await db.table(OWNER_TABLE[att.ownerType]).get(att.ownerId)) continue
    if ((await db.blobs.where('attachmentId').equals(att.id).count()) === 0) continue
    await attachments.remove(att)
  }
}

/**
 * Запуск приложения: досевает встроенный каталог, убирает брошенные черновые вложения, затем запускает
 * синхронизацию. Сбои не ломают запуск — только предупреждение в консоли: без сида экраны всё равно видят
 * встроенный каталог (хуки подмешивают его), черновики уберутся при следующем запуске, а синхронизация
 * (нет сети, Диск недоступен) повторит попытку сама.
 */
export async function initApp(deps: InitDeps = {}): Promise<void> {
  const { db = appDb, initSync = appInitSync, attachments = attachmentStore, now = Date.now } = deps
  try {
    await ensureSeed(db, BUILTIN_CATALOG)
  } catch (e) {
    console.warn('Встроенный каталог не записан в базу', e)
  }
  try {
    await sweepOrphanAttachments(db, attachments, now())
  } catch (e) {
    console.warn('Брошенные черновые вложения не убраны', e)
  }
  try {
    await initSync()
  } catch (e) {
    console.warn('Синхронизация не запустилась', e)
  }
}
