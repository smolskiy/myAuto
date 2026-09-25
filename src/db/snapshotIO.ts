import type { MyAutoDB } from './schema'
import { SYNC_TABLES } from './schema'
import { TABLE_NAMES, emptySnapshot, type Snapshot, type SnapshotTables } from '../domain/snapshot'
import { pickRow } from '../domain/merge'
import type { Row } from '../domain/types'

/** Все строки, включая удалённые — для выгрузки на Диск и в JSON-бэкап. Единая транзакция чтения. */
export async function readSnapshot(db: MyAutoDB, now: number = Date.now()): Promise<Snapshot> {
  const snapshot = emptySnapshot(now)
  const tables = SYNC_TABLES.map((name) => db.table(name))
  await db.transaction('r', tables, async () => {
    for (const name of TABLE_NAMES) {
      const rows = await db.table(name).toArray()
      ;(snapshot.tables[name] as unknown[]) = rows
    }
  })
  return snapshot
}

/**
 * Записывает строки с Диска/из бэкапа. Не считается локальным изменением.
 * Строка новее, чем в снимке, могла появиться между readSnapshot и applyRows (правка на
 * этом же устройстве в процессе синхронизации) — за каждую входящую строку побеждает
 * pickRow(текущая, входящая), а не входящая безусловно.
 */
export async function applyRows(db: MyAutoDB, rows: Partial<SnapshotTables>): Promise<void> {
  const tables = SYNC_TABLES.map((name) => db.table(name))
  await db.transaction('rw', tables, async () => {
    for (const name of TABLE_NAMES) {
      const incoming = rows[name] as Row[] | undefined
      if (!incoming || incoming.length === 0) continue
      const table = db.table(name)
      const current = await table.bulkGet(incoming.map((r) => r.id))
      const resolved = incoming.map((row, i) => {
        const cur = current[i] as Row | undefined
        return cur ? pickRow(cur, row) : row
      })
      await table.bulkPut(resolved)
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
