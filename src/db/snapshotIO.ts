import type { MyAutoDB } from './schema'
import { SYNC_TABLES } from './schema'
import { TABLE_NAMES, emptySnapshot, type Snapshot, type SnapshotTables } from '../domain/snapshot'

/** Все строки, включая удалённые — для выгрузки на Диск и в JSON-бэкап. */
export async function readSnapshot(db: MyAutoDB, now: number = Date.now()): Promise<Snapshot> {
  const snapshot = emptySnapshot(now)
  for (const name of TABLE_NAMES) {
    const rows = await db.table(name).toArray()
    ;(snapshot.tables[name] as unknown[]) = rows
  }
  return snapshot
}

/** Записывает строки с Диска/из бэкапа. Не считается локальным изменением. */
export async function applyRows(db: MyAutoDB, rows: Partial<SnapshotTables>): Promise<void> {
  const tables = SYNC_TABLES.map((name) => db.table(name))
  await db.transaction('rw', tables, async () => {
    for (const name of TABLE_NAMES) {
      const tableRows = rows[name]
      if (tableRows && tableRows.length > 0) await db.table(name).bulkPut(tableRows)
    }
  })
}

/**
 * Полностью заменяет синхронизируемые таблицы содержимым снимка.
 * `blobs` и `meta` не трогает — встроенный каталог досеется при следующем старте приложения.
 */
export async function replaceAll(db: MyAutoDB, snapshot: Snapshot): Promise<void> {
  const tables = SYNC_TABLES.map((name) => db.table(name))
  await db.transaction('rw', tables, async () => {
    for (const name of TABLE_NAMES) {
      await db.table(name).clear()
      const rows = snapshot.tables[name]
      if (rows.length > 0) await db.table(name).bulkPut(rows)
    }
  })
}
