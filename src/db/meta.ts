import type { MyAutoDB } from './schema'

export const META_KEYS = {
  theme: 'theme',
  activeVehicleId: 'activeVehicleId',
  yandexToken: 'yandex.token',
  yandexClientId: 'yandex.clientId',
  lastSyncAt: 'sync.lastAt',
  lastBackupDate: 'sync.lastBackupDate',
  remoteRevision: 'sync.remoteRevision',
} as const

export async function getMeta<T>(db: MyAutoDB, key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row ? (row.value as T) : fallback
}

export async function setMeta(db: MyAutoDB, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

export async function deleteMeta(db: MyAutoDB, key: string): Promise<void> {
  await db.meta.delete(key)
}
