import type { MyAutoDB } from './schema'
import { db } from './instance'
import { createRepo, type Draft, type Repo } from './repo'
import { newId } from '../domain/ids'
import type {
  Attachment, CarRecord, CatalogItem, ID, ISODate, Master, Place, ReminderRule, TireSet, Vehicle, VehicleDocument,
} from '../domain/types'

export function createRepos(database: MyAutoDB) {
  const vehiclesRepo = createRepo<Vehicle>(database, 'vehicles')
  const recordsRepo = createRepo<CarRecord>(database, 'records')
  const placesRepo = createRepo<Place>(database, 'places')
  const mastersRepo = createRepo<Master>(database, 'masters')
  const catalogRepo = createRepo<CatalogItem>(database, 'catalogItems')
  const remindersRepo = createRepo<ReminderRule>(database, 'reminderRules')
  const documentsRepo = createRepo<VehicleDocument>(database, 'documents')
  const tireSetsRepo = createRepo<TireSet>(database, 'tireSets')
  const attachmentsRepo = createRepo<Attachment>(database, 'attachments')

  const records: Repo<CarRecord> & { duplicate(id: ID, date: ISODate): Promise<CarRecord> } = {
    ...recordsRepo,
    async duplicate(id, date) {
      const src = await recordsRepo.get(id)
      if (!src) throw new Error('Запись не найдена')
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, deleted: _deleted, odometer: _odometer, ...draft } = src
      if (draft.kind === 'service') {
        return recordsRepo.create({
          ...draft,
          date,
          works: draft.works.map((w) => ({ ...w, id: newId() })),
          parts: draft.parts.map((p) => ({ ...p, id: newId() })),
        })
      }
      return recordsRepo.create({ ...draft, date } as Draft<CarRecord>)
    },
  }

  const vehicles: Repo<Vehicle> & { nextOrder(): Promise<number> } = {
    ...vehiclesRepo,
    async nextOrder() {
      const rows = await database.vehicles.toArray()
      return rows.reduce((max, v) => Math.max(max, v.order), -1) + 1
    },
  }

  return {
    vehicles,
    records,
    places: placesRepo,
    masters: mastersRepo,
    catalog: catalogRepo,
    reminders: remindersRepo,
    documents: documentsRepo,
    tireSets: tireSetsRepo,
    attachments: attachmentsRepo,
  }
}

export const repos = createRepos(db)
