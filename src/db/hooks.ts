/**
 * Живые React-хуки для экранов: данные базы + расчёты domain/calc внутри одного useLiveQuery,
 * поэтому результат обновляется вместе с базой.
 *
 * Соглашения: undefined — идёт загрузка (или ещё не известна машина, для списков по машине);
 * null — не найдено (или id не передан). Удалённые строки (deleted: true) не возвращаются никогда.
 */
import type { Table } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useMemo } from 'react'
import { db } from './instance'
import { META_KEYS, getMeta, setMeta } from './meta'
import { BUILTIN_CATALOG, ITEM_GROUP_LABELS, withBuiltinDefaults } from '../domain/catalog'
import { suggestBrands } from '../domain/brands'
import { todayISO } from '../domain/dates'
import { partsStats, serviceStats, type PartsStats, type ServiceStats } from '../domain/calc/garageStats'
import { costBreakdown, type CostBreakdown } from '../domain/calc/costs'
import { averageConsumption, fuelIntervals, type FuelInterval } from '../domain/calc/fuel'
import { itemHistory, lastPartFor, type ItemHistoryEntry, type LastPart } from '../domain/calc/itemHistory'
import { averageDailyKm, currentOdometer } from '../domain/calc/odometer'
import {
  documentDeadlines,
  evaluateReminders,
  upcoming,
  type DeadlineStatus,
  type ReminderStatus,
  type UpcomingItem,
} from '../domain/calc/reminders'
import { searchRecords } from '../domain/calc/search'
import { tireSetMileage } from '../domain/calc/tires'
import { masterSpend, placeSpend, visitStats, type VisitStats } from '../domain/calc/visits'
import type {
  Attachment,
  CarRecord,
  CatalogItem,
  DocumentKind,
  ID,
  ISODate,
  Master,
  OwnerType,
  Place,
  PlaceKind,
  RecordKind,
  ReminderRule,
  Row,
  TireSet,
  TireSetStatus,
  Vehicle,
  VehicleDocument,
} from '../domain/types'

type Range = { from?: ISODate; to?: ISODate }

const live = <T extends Row>(rows: T[]): T[] => rows.filter((r) => !r.deleted)
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'ru')

async function getLive<T extends Row>(table: Table<T, ID>, id?: ID): Promise<T | null> {
  if (!id) return null
  const row = await table.get(id)
  return row && !row.deleted ? row : null
}

/** Живые записи машины. */
async function vehicleRecords(vehicleId: ID): Promise<CarRecord[]> {
  return live(await db.records.where('vehicleId').equals(vehicleId).toArray())
}

/** Живые записи всех машин, кроме записей удалённых машин. */
async function allRecords(): Promise<CarRecord[]> {
  const [records, vehicles] = await Promise.all([db.records.toArray(), db.vehicles.toArray()])
  const deletedVehicles = new Set(vehicles.filter((v) => v.deleted).map((v) => v.id))
  return records.filter((r) => !r.deleted && !deletedVehicles.has(r.vehicleId))
}

/** Каталог: строки базы + встроенные позиции, которых в базе нет (надгробие встроенную позицию не воскрешает). */
async function loadCatalog(): Promise<CatalogItem[]> {
  // Нетронутые встроенные строки — по текущему коду (переименования доходят до засеянных баз).
  const rows = (await db.catalogItems.toArray()).map(withBuiltinDefaults)
  const ids = new Set(rows.map((r) => r.id))
  return [...live(rows), ...BUILTIN_CATALOG.filter((i) => !ids.has(i.id))]
}

// ——— Машины ———

export function useVehicles(opts: { includeArchived?: boolean } = {}): Vehicle[] | undefined {
  const includeArchived = opts.includeArchived ?? false
  return useLiveQuery(async () => {
    const rows = live(await db.vehicles.orderBy('order').toArray())
    return includeArchived ? rows : rows.filter((v) => !v.archived)
  }, [includeArchived])
}

export function useVehicle(id?: ID): Vehicle | null | undefined {
  return useLiveQuery(() => getLive(db.vehicles, id), [id])
}

/**
 * Активная машина: выбранная в настройках устройства, иначе первая неархивная по порядку, иначе null.
 * Архивная (или удалённая) машина активной не бывает: выбор, указывающий на неё, уступает первой неархивной.
 */
export function useActiveVehicle(): {
  vehicle: Vehicle | null | undefined
  setActive(id: ID): Promise<void>
} {
  const vehicle = useLiveQuery(async () => {
    const activeId = await getMeta<ID | null>(db, META_KEYS.activeVehicleId, null)
    const rows = live(await db.vehicles.orderBy('order').toArray()).filter((v) => !v.archived)
    return (activeId ? rows.find((v) => v.id === activeId) : undefined) ?? rows[0] ?? null
  }, [])
  const setActive = useCallback((id: ID) => setMeta(db, META_KEYS.activeVehicleId, id), [])
  return { vehicle, setActive }
}

// ——— Записи ———

export interface RecordFilter {
  kinds?: RecordKind[]
  itemId?: ID
  placeId?: ID
  masterId?: ID
  from?: ISODate
  to?: ISODate
  query?: string
}

function matchesFilter(r: CarRecord, f: RecordFilter): boolean {
  if (f.kinds && !f.kinds.includes(r.kind)) return false
  if (f.from && r.date < f.from) return false
  if (f.to && r.date > f.to) return false
  if (f.itemId) {
    if (r.kind !== 'service') return false
    if (!r.works.some((w) => w.itemId === f.itemId) && !r.parts.some((p) => p.itemId === f.itemId))
      return false
  }
  // то же правило, что и в статистике места/мастера (domain/calc/visits)
  if (f.placeId && placeSpend(r, f.placeId) === null) return false
  if (f.masterId && masterSpend(r, f.masterId) === null) return false
  return true
}

/** Новые сверху: дата ↓, пробег ↓, время создания ↓. */
function compareRecords(a: CarRecord, b: CarRecord): number {
  return b.date.localeCompare(a.date) || (b.odometer ?? -1) - (a.odometer ?? -1) || b.createdAt - a.createdAt
}

/**
 * Журнал с фильтром: одной машины или `'all'` — всех машин (визиты места, мастера);
 * `undefined` — машина ещё не известна, результат undefined. `query` — поиск по тексту записи, строкам,
 * местам и мастерам. Фильтр по месту/мастеру — по правилу визитов (`placeSpend`/`masterSpend`).
 */
export function useRecords(vehicleId?: ID | 'all', filter?: RecordFilter): CarRecord[] | undefined {
  // Фильтр сериализуется: объект-литерал в каждом рендере не должен перезапускать запрос.
  const filterKey = JSON.stringify(filter ?? {})
  return useLiveQuery(async () => {
    if (!vehicleId) return undefined
    const f = JSON.parse(filterKey) as RecordFilter
    const source = vehicleId === 'all' ? await allRecords() : await vehicleRecords(vehicleId)
    let rows = source.filter((r) => matchesFilter(r, f))
    if (f.query?.trim()) {
      const [places, masters, catalog] = await Promise.all([
        db.places.toArray(),
        db.masters.toArray(),
        loadCatalog(),
      ])
      rows = searchRecords(rows, f.query, {
        places: new Map(live(places).map((p) => [p.id, p])),
        masters: new Map(live(masters).map((m) => [m.id, m])),
        catalog: new Map(catalog.map((c) => [c.id, c])),
      })
    }
    return rows.sort(compareRecords)
  }, [vehicleId, filterKey])
}

export function useRecord(id?: ID): CarRecord | null | undefined {
  return useLiveQuery(() => getLive(db.records, id), [id])
}

// ——— Места и мастера ———

export function usePlaces(kind?: PlaceKind): Place[] | undefined {
  return useLiveQuery(async () => {
    const rows = live(await db.places.toArray())
    return (kind ? rows.filter((p) => p.kind === kind) : rows).sort(byName)
  }, [kind])
}

export function usePlace(id?: ID): Place | null | undefined {
  return useLiveQuery(() => getLive(db.places, id), [id])
}

export function useMasters(placeId?: ID): Master[] | undefined {
  return useLiveQuery(async () => {
    const rows = live(await db.masters.toArray())
    return (placeId ? rows.filter((m) => m.placeId === placeId) : rows).sort(byName)
  }, [placeId])
}

export function useMaster(id?: ID): Master | null | undefined {
  return useLiveQuery(() => getLive(db.masters, id), [id])
}

// ——— Каталог ———

const GROUP_ORDER = Object.keys(ITEM_GROUP_LABELS)

/** Каталог узлов по группам (в порядке ITEM_GROUP_LABELS), внутри — по названию. Скрытые — по запросу. */
export function useCatalog(opts: { includeHidden?: boolean } = {}): CatalogItem[] | undefined {
  const includeHidden = opts.includeHidden ?? false
  return useLiveQuery(async () => {
    const rows = await loadCatalog()
    return (includeHidden ? rows : rows.filter((i) => !i.hidden)).sort(
      (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || byName(a, b),
    )
  }, [includeHidden])
}

// ——— Напоминания и сроки ———

export function useReminderRules(vehicleId?: ID): ReminderRule[] | undefined {
  return useLiveQuery(async () => {
    if (!vehicleId) return undefined
    return live(await db.reminderRules.where('vehicleId').equals(vehicleId).toArray())
  }, [vehicleId])
}

export function useReminderRule(id?: ID): ReminderRule | null | undefined {
  return useLiveQuery(() => getLive(db.reminderRules, id), [id])
}

interface VehicleSnapshot {
  vehicle: Vehicle | null
  records: CarRecord[]
  rules: ReminderRule[]
  docs: VehicleDocument[]
  catalog: CatalogItem[]
}

async function loadVehicleSnapshot(vehicleId: ID): Promise<VehicleSnapshot> {
  const [vehicle, records, rules, docs, catalog] = await Promise.all([
    getLive(db.vehicles, vehicleId),
    vehicleRecords(vehicleId),
    db.reminderRules.where('vehicleId').equals(vehicleId).toArray(),
    db.documents.where('vehicleId').equals(vehicleId).toArray(),
    loadCatalog(),
  ])
  return { vehicle, records, rules: live(rules), docs: live(docs), catalog }
}

function reminderStatuses(s: VehicleSnapshot, today: ISODate): ReminderStatus[] {
  return evaluateReminders(s.rules, {
    records: s.records,
    catalog: s.catalog,
    today,
    currentOdometer: currentOdometer(s.records, s.vehicle ?? undefined),
    avgDailyKm: averageDailyKm(s.records, today),
  })
}

export function useReminderStatuses(
  vehicleId?: ID,
  today: ISODate = todayISO(),
): ReminderStatus[] | undefined {
  return useLiveQuery(async () => {
    if (!vehicleId) return undefined
    return reminderStatuses(await loadVehicleSnapshot(vehicleId), today)
  }, [vehicleId, today])
}

export function useDeadlines(vehicleId?: ID, today: ISODate = todayISO()): DeadlineStatus[] | undefined {
  return useLiveQuery(async () => {
    if (!vehicleId) return undefined
    const s = await loadVehicleSnapshot(vehicleId)
    return documentDeadlines(s.docs, s.records, today)
  }, [vehicleId, today])
}

/** Список «Скоро»: напоминания и сроки документов машины в одном порядке. */
export function useUpcoming(
  vehicleId?: ID,
  limit?: number,
  today: ISODate = todayISO(),
): UpcomingItem[] | undefined {
  return useLiveQuery(async () => {
    if (!vehicleId) return undefined
    const s = await loadVehicleSnapshot(vehicleId)
    return upcoming(reminderStatuses(s, today), documentDeadlines(s.docs, s.records, today), limit)
  }, [vehicleId, limit, today])
}

// ——— Документы, шины, вложения ———

const DOCUMENT_ORDER: DocumentKind[] = ['osago', 'kasko', 'diagCard', 'sts', 'pts', 'license', 'other']

export function useDocuments(vehicleId?: ID): VehicleDocument[] | undefined {
  return useLiveQuery(async () => {
    if (!vehicleId) return undefined
    const rows = live(await db.documents.where('vehicleId').equals(vehicleId).toArray())
    return rows.sort(
      (a, b) => DOCUMENT_ORDER.indexOf(a.kind) - DOCUMENT_ORDER.indexOf(b.kind) || a.createdAt - b.createdAt,
    )
  }, [vehicleId])
}

export function useDocument(id?: ID): VehicleDocument | null | undefined {
  return useLiveQuery(() => getLive(db.documents, id), [id])
}

const TIRE_STATUS_ORDER: TireSetStatus[] = ['installed', 'stored', 'retired']

export function useTireSets(vehicleId?: ID): TireSet[] | undefined {
  return useLiveQuery(async () => {
    if (!vehicleId) return undefined
    const rows = live(await db.tireSets.where('vehicleId').equals(vehicleId).toArray())
    return rows.sort(
      (a, b) =>
        TIRE_STATUS_ORDER.indexOf(a.status) - TIRE_STATUS_ORDER.indexOf(b.status) ||
        a.createdAt - b.createdAt,
    )
  }, [vehicleId])
}

export function useTireSet(id?: ID): TireSet | null | undefined {
  return useLiveQuery(() => getLive(db.tireSets, id), [id])
}

/** Пробег комплекта шин; комплект не найден — 0. */
export function useTireSetMileage(setId?: ID): number | undefined {
  return useLiveQuery(async () => {
    if (!setId) return undefined
    const set = await getLive(db.tireSets, setId)
    if (!set) return 0
    const [vehicle, records] = await Promise.all([
      getLive(db.vehicles, set.vehicleId),
      vehicleRecords(set.vehicleId),
    ])
    return tireSetMileage(records, setId, currentOdometer(records, vehicle ?? undefined))
  }, [setId])
}

export function useAttachments(ownerType: OwnerType, ownerId?: ID): Attachment[] | undefined {
  return useLiveQuery(async () => {
    if (!ownerId) return undefined
    const rows = live(
      await db.attachments.where('[ownerType+ownerId]').equals([ownerType, ownerId]).toArray(),
    )
    return rows.sort((a, b) => a.createdAt - b.createdAt)
  }, [ownerType, ownerId])
}

// ——— Пробег, расходы, топливо ———

export function useCurrentOdometer(vehicleId?: ID): number | null | undefined {
  return useLiveQuery(async () => {
    if (!vehicleId) return undefined
    const [vehicle, records] = await Promise.all([getLive(db.vehicles, vehicleId), vehicleRecords(vehicleId)])
    return currentOdometer(records, vehicle ?? undefined)
  }, [vehicleId])
}

export function useAverageDailyKm(vehicleId?: ID, today: ISODate = todayISO()): number | null | undefined {
  return useLiveQuery(async () => {
    if (!vehicleId) return undefined
    return averageDailyKm(await vehicleRecords(vehicleId), today)
  }, [vehicleId, today])
}

export function useCostBreakdown(vehicleId?: ID, range?: Range): CostBreakdown | undefined {
  const rangeKey = JSON.stringify(range ?? {})
  return useLiveQuery(async () => {
    if (!vehicleId) return undefined
    return costBreakdown(await vehicleRecords(vehicleId), JSON.parse(rangeKey) as Range)
  }, [vehicleId, rangeKey])
}

/** «Статистика → Сервис»: работы и запчасти, места, мастера, месяцы. */
export function useServiceStats(vehicleId?: ID, range?: Range): ServiceStats | undefined {
  const rangeKey = JSON.stringify(range ?? {})
  return useLiveQuery(async () => {
    if (!vehicleId) return undefined
    return serviceStats(await vehicleRecords(vehicleId), JSON.parse(rangeKey) as Range)
  }, [vehicleId, rangeKey])
}

/** «Статистика → Запчасти»: узлы, бренды, где куплены. */
export function usePartsStats(vehicleId?: ID, range?: Range): PartsStats | undefined {
  const rangeKey = JSON.stringify(range ?? {})
  return useLiveQuery(async () => {
    if (!vehicleId) return undefined
    const [records, catalog] = await Promise.all([vehicleRecords(vehicleId), loadCatalog()])
    return partsStats(records, JSON.parse(rangeKey) as Range, catalog)
  }, [vehicleId, rangeKey])
}

/** Интервалы «полный бак → полный бак», закончившиеся в периоде, и средний расход по ним. */
export function useFuelStats(
  vehicleId?: ID,
  range?: Range,
): { intervals: FuelInterval[]; average: number | null } | undefined {
  const rangeKey = JSON.stringify(range ?? {})
  return useLiveQuery(async () => {
    if (!vehicleId) return undefined
    const r = JSON.parse(rangeKey) as Range
    const intervals = fuelIntervals(await vehicleRecords(vehicleId)).filter(
      (i) => (!r.from || i.toDate >= r.from) && (!r.to || i.toDate <= r.to),
    )
    return { intervals, average: averageConsumption(intervals) }
  }, [vehicleId, rangeKey])
}

// ——— Узлы и бренды ———

export function useItemHistory(vehicleId?: ID, itemId?: ID): ItemHistoryEntry[] | undefined {
  return useLiveQuery(async () => {
    if (!vehicleId || !itemId) return undefined
    return itemHistory(await vehicleRecords(vehicleId), itemId)
  }, [vehicleId, itemId])
}

export function useLastPart(vehicleId?: ID, itemId?: ID): LastPart | null | undefined {
  return useLiveQuery(async () => {
    if (!vehicleId || !itemId) return undefined
    return lastPartFor(await vehicleRecords(vehicleId), itemId)
  }, [vehicleId, itemId])
}

/** Подсказки бренда: своя история (все машины, новые записи первыми) + справочник. */
export function useBrandSuggestions(query: string, limit?: number): string[] {
  const history = useLiveQuery(
    async () => {
      const rows = (await allRecords()).sort(compareRecords)
      const brands: string[] = []
      for (const r of rows) {
        if (r.kind !== 'service') continue
        for (const p of r.parts) if (p.brand?.trim()) brands.push(p.brand.trim())
      }
      return brands
    },
    [],
    [] as string[],
  )
  return useMemo(() => suggestBrands(query, history, limit), [query, history, limit])
}

// ——— Статистика мест и мастеров ———

export type { VisitStats }

/** Визиты к месту по всем машинам: те же записи, что `useRecords('all', { placeId })`. */
export function usePlaceStats(placeId?: ID): VisitStats | undefined {
  return useLiveQuery(async () => {
    if (!placeId) return undefined
    return visitStats(await allRecords(), (r) => placeSpend(r, placeId))
  }, [placeId])
}

/** Визиты к мастеру по всем машинам: те же записи, что `useRecords('all', { masterId })`. */
export function useMasterStats(masterId?: ID): VisitStats | undefined {
  return useLiveQuery(async () => {
    if (!masterId) return undefined
    return visitStats(await allRecords(), (r) => masterSpend(r, masterId))
  }, [masterId])
}
