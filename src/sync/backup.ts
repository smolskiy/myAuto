import type { MyAutoDB } from '../db/schema'
import { SYNC_TABLES } from '../db/schema'
import { applyRows, readSnapshot } from '../db/snapshotIO'
import { emitLocalChange } from '../db/changes'
import { tick } from '../db/clock'
import { diffTables, mergeSnapshots } from '../domain/merge'
import { SnapshotError, TABLE_NAMES, parseSnapshot, type Snapshot, type TableName } from '../domain/snapshot'
import type { CatalogItem, Row } from '../domain/types'
import type { BackupService, ImportPreview } from './contracts'
import { buildWorkbook } from './excel'

/**
 * Ручные выгрузки (спецификация, раздел 6.4): JSON — полный снимок в формате garage.json без файлов
 * вложений; загрузка JSON — «Объединить» (по умолчанию, правило слияния то же, что у синхронизации:
 * более новые правки не затираются) или «Заменить всё»; Excel — для чтения человеком.
 */

async function readImport(file: File): Promise<Snapshot> {
  let json: unknown
  try {
    json = JSON.parse(await file.text())
  } catch {
    throw new SnapshotError('Это не файл «Мой авто»')
  }
  return parseSnapshot(json)
}

/**
 * «Заменить всё» так, чтобы замена пережила синхронизацию (простая очистка таблиц не годится: строки
 * с Диска вернулись бы следующим циклом). Одной транзакцией: живые строки, которых нет в файле, получают
 * надгробие с новым `updatedAt`; строки файла ставятся с `updatedAt` новее и локальной, и файловой версии —
 * так версия из файла побеждает копию на Диске. Встроенный каталог, которого нет в файле, не трогаем:
 * сид надгробия не воскрешает, и каталог пропал бы насовсем.
 */
async function replaceWith(db: MyAutoDB, imported: Snapshot): Promise<void> {
  await db.transaction('rw', SYNC_TABLES.map((name) => db.table(name)), async () => {
    for (const name of TABLE_NAMES) {
      const table = db.table<Row, string>(name)
      const local = await table.toArray()
      const localById = new Map(local.map((r) => [r.id, r]))
      const fileRows = imported.tables[name] as Row[]
      const inFile = new Set(fileRows.map((r) => r.id))
      const tombstones = local
        .filter((r) => !r.deleted && !inFile.has(r.id))
        .filter((r) => !(name === 'catalogItems' && (r as CatalogItem).builtin))
        .map((r) => ({ ...r, deleted: true, updatedAt: tick(r.updatedAt) }))
      const restored = fileRows.map((r) => ({
        ...r,
        updatedAt: tick(Math.max(localById.get(r.id)?.updatedAt ?? 0, r.updatedAt)),
      }))
      const rows = [...tombstones, ...restored]
      if (rows.length > 0) await table.bulkPut(rows)
    }
  })
}

export function createBackupService(deps: { db: MyAutoDB; now?: () => number }): BackupService {
  const { db } = deps
  const now = deps.now ?? (() => Date.now())

  return {
    async exportJson() {
      return new Blob([JSON.stringify(await readSnapshot(db, now()))], { type: 'application/json' })
    },

    async previewImport(file): Promise<ImportPreview> {
      const snapshot = await readImport(file)
      const counts = {} as Record<TableName, number>
      for (const name of TABLE_NAMES) counts[name] = (snapshot.tables[name] as Row[]).filter((r) => !r.deleted).length
      return { exportedAt: snapshot.exportedAt, counts }
    },

    async importJson(file, mode) {
      const imported = await readImport(file)
      if (mode === 'replace') {
        await replaceWith(db, imported)
        emitLocalChange('vehicles')
        return
      }
      const changed = await db.transaction('rw', SYNC_TABLES.map((name) => db.table(name)), async () => {
        const local = await readSnapshot(db, now())
        const diff = diffTables(local.tables, mergeSnapshots(local, imported).tables)
        await applyRows(db, diff)
        return Object.keys(diff) as TableName[]
      })
      // Загрузка файла — действие пользователя: синхронизацию запускаем, даже если нового не нашлось.
      for (const table of changed.length > 0 ? changed : (['vehicles'] as const)) emitLocalChange(table)
    },

    async exportExcel() {
      return buildWorkbook(await readSnapshot(db, now()))
    },
  }
}
