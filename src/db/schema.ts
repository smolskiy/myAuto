import Dexie, { type Table } from 'dexie'
import type { TableName } from '../domain/snapshot'
import type {
  Attachment,
  CarRecord,
  CatalogItem,
  ID,
  Master,
  Place,
  ReminderRule,
  TireSet,
  Vehicle,
  VehicleDocument,
} from '../domain/types'

/** Файл вложения на устройстве. Не синхронизируется как строка — только как файл на Диске. */
export interface BlobRow {
  /** `${attachmentId}:orig` | `${attachmentId}:thumb` */
  key: string
  attachmentId: ID
  variant: 'orig' | 'thumb'
  blob: Blob
  /** 1 — ещё не загружен на Диск (IndexedDB не индексирует boolean). */
  pending: 0 | 1
  size: number
  lastAccess: number
}

/** Настройки устройства: тема, активная машина, токен Яндекса и т. п. Не синхронизируются. */
export interface MetaRow {
  key: string
  value: unknown
}

export const SYNC_TABLES: readonly TableName[] = [
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

export class MyAutoDB extends Dexie {
  vehicles!: Table<Vehicle, ID>
  records!: Table<CarRecord, ID>
  places!: Table<Place, ID>
  masters!: Table<Master, ID>
  catalogItems!: Table<CatalogItem, ID>
  reminderRules!: Table<ReminderRule, ID>
  documents!: Table<VehicleDocument, ID>
  tireSets!: Table<TireSet, ID>
  attachments!: Table<Attachment, ID>
  blobs!: Table<BlobRow, string>
  meta!: Table<MetaRow, string>

  constructor(name = 'myauto') {
    super(name)
    this.version(1).stores({
      vehicles: 'id, order',
      records: 'id, vehicleId, [vehicleId+date], date, kind, updatedAt',
      places: 'id, kind',
      masters: 'id, placeId',
      catalogItems: 'id, group',
      reminderRules: 'id, vehicleId',
      documents: 'id, vehicleId',
      tireSets: 'id, vehicleId',
      attachments: 'id, [ownerType+ownerId]',
      blobs: 'key, attachmentId, pending, lastAccess',
      meta: 'key',
    })
  }
}
