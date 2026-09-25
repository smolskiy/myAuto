import type {
  Attachment,
  CarRecord,
  CatalogItem,
  Master,
  Place,
  ReminderRule,
  TireSet,
  Vehicle,
  VehicleDocument,
} from './types'

/** Формат garage.json и ручного JSON-бэкапа. Замороженный контракт. */
export const SNAPSHOT_FORMAT = 'myauto-garage'
export const SCHEMA_VERSION = 1

export interface SnapshotTables {
  vehicles: Vehicle[]
  records: CarRecord[]
  places: Place[]
  masters: Master[]
  catalogItems: CatalogItem[]
  reminderRules: ReminderRule[]
  documents: VehicleDocument[]
  tireSets: TireSet[]
  attachments: Attachment[]
}

export type TableName = keyof SnapshotTables

export const TABLE_NAMES: readonly TableName[] = [
  'vehicles',
  'records',
  'places',
  'masters',
  'catalogItems',
  'reminderRules',
  'documents',
  'tireSets',
  'attachments',
]

export interface Snapshot {
  format: typeof SNAPSHOT_FORMAT
  schemaVersion: number
  exportedAt: number
  tables: SnapshotTables
}

export class SnapshotError extends Error {}

export function emptyTables(): SnapshotTables {
  return {
    vehicles: [],
    records: [],
    places: [],
    masters: [],
    catalogItems: [],
    reminderRules: [],
    documents: [],
    tireSets: [],
    attachments: [],
  }
}

export function emptySnapshot(now: number = Date.now()): Snapshot {
  return { format: SNAPSHOT_FORMAT, schemaVersion: SCHEMA_VERSION, exportedAt: now, tables: emptyTables() }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Проверяет и нормализует снимок из файла или с Диска. Бросает SnapshotError с текстом для пользователя. */
export function parseSnapshot(json: unknown): Snapshot {
  if (!isObject(json) || json.format !== SNAPSHOT_FORMAT) throw new SnapshotError('Это не файл «Мой авто»')
  const version = typeof json.schemaVersion === 'number' ? json.schemaVersion : 0
  if (version > SCHEMA_VERSION) {
    throw new SnapshotError('Файл создан более новой версией приложения — обновите приложение')
  }
  const rawTables = isObject(json.tables) ? json.tables : {}
  const tables = emptyTables()
  for (const name of TABLE_NAMES) {
    const rows = rawTables[name]
    if (rows === undefined) continue
    if (!Array.isArray(rows)) throw new SnapshotError(`Повреждённая таблица ${name}`)
    for (const r of rows) {
      if (!isObject(r) || typeof r.id !== 'string' || typeof r.updatedAt !== 'number') {
        throw new SnapshotError(`Повреждённая строка в таблице ${name}`)
      }
    }
    ;(tables[name] as unknown[]) = rows
  }
  return {
    format: SNAPSHOT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: typeof json.exportedAt === 'number' ? json.exportedAt : 0,
    tables,
  }
}
