import type { MyAutoDB } from '../db/schema'
import { SYNC_TABLES } from '../db/schema'
import { applyRows, readSnapshot, replaceAll } from '../db/snapshotIO'
import { emitLocalChange } from '../db/changes'
import { diffTables, mergeSnapshots } from '../domain/merge'
import { SnapshotError, TABLE_NAMES, parseSnapshot, type Snapshot, type TableName } from '../domain/snapshot'
import type { Row } from '../domain/types'
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
        await replaceAll(db, imported)
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
