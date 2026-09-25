import type { Row } from './types'
import { TABLE_NAMES, type Snapshot, type SnapshotTables } from './snapshot'

/**
 * Слияние двух копий базы — локальной и той, что лежит на Яндекс.Диске.
 *
 * Правило одно для всех таблиц: по каждому id побеждает запись, изменённая позже.
 * При равном времени побеждает удаление (иначе удалённое могло бы «воскреснуть»),
 * а дальше — детерминированное сравнение, чтобы оба устройства пришли к одному результату.
 *
 * Функция чистая и коммутативная: merge(a, b) и merge(b, a) дают одно и то же.
 * Поэтому неважно, какой телефон синхронизируется первым, а повторная
 * синхронизация ничего не меняет.
 *
 * Встроенный каталог отдельной обработки не требует: у позиций стабильные id и
 * updatedAt = 0, поэтому любая правка пользователя побеждает, а одинаковые позиции совпадают.
 */
export function pickRow<T extends Row>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b
  if (!!a.deleted !== !!b.deleted) return a.deleted ? a : b
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b
}

export function mergeRows<T extends Row>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>()
  for (const r of a) map.set(r.id, r)
  for (const r of b) {
    const cur = map.get(r.id)
    map.set(r.id, cur ? pickRow(cur, r) : r)
  }
  return [...map.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
}

export function mergeSnapshots(a: Snapshot, b: Snapshot): Snapshot {
  const tables = {} as SnapshotTables
  for (const name of TABLE_NAMES) {
    const merged = mergeRows(a.tables[name] as Row[], b.tables[name] as Row[])
    ;(tables[name] as unknown[]) = merged
  }
  return {
    format: a.format,
    schemaVersion: a.schemaVersion,
    exportedAt: Math.max(a.exportedAt, b.exportedAt),
    tables,
  }
}

/** Отпечаток таблицы: совпал — значит, писать нечего. */
function fingerprint(rows: Row[]): string {
  return rows
    .map((r) => `${r.id}:${r.updatedAt}:${r.deleted ? 1 : 0}`)
    .sort()
    .join(',')
}

export function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return TABLE_NAMES.every((name) => fingerprint(a.tables[name] as Row[]) === fingerprint(b.tables[name] as Row[]))
}

/** Строки, которые нужно записать локально: новые или изменившиеся после слияния. */
export function changedRows<T extends Row>(local: T[], merged: T[]): T[] {
  const cur = new Map(local.map((r) => [r.id, r]))
  return merged.filter((r) => {
    const l = cur.get(r.id)
    return !l || l.updatedAt !== r.updatedAt || !!l.deleted !== !!r.deleted || JSON.stringify(l) !== JSON.stringify(r)
  })
}

export function diffTables(local: SnapshotTables, merged: SnapshotTables): Partial<SnapshotTables> {
  const result: Partial<SnapshotTables> = {}
  for (const name of TABLE_NAMES) {
    const changed = changedRows(local[name] as Row[], merged[name] as Row[])
    if (changed.length > 0) (result[name] as unknown[]) = changed
  }
  return result
}
