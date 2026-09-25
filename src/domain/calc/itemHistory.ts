import { diffDays } from '../dates'
import type { CarRecord, ID, ISODate, Kopecks, PartLine, ServiceRecord } from '../types'
import { lineTotal } from './lines'

export interface ItemHistoryEntry {
  recordId: ID
  date: ISODate
  odometer?: number
  line: 'part' | 'work'
  name: string
  brand?: string
  partNumber?: string
  /** Стоимость строки: для запчасти — количество × цена за единицу, для работы — цена работы. */
  price?: Kopecks
  placeId?: ID
  masterId?: ID
  /** Фактический интервал от предыдущей (более старой) записи с этим узлом. */
  sinceKm?: number
  sinceDays?: number
}

/** Живые записи ТО с этим узлом, новые сверху (по дате, затем по пробегу). */
function serviceRecordsWith(records: CarRecord[], itemId: ID): ServiceRecord[] {
  return records
    .filter((r): r is ServiceRecord => r.kind === 'service' && !r.deleted
      && (r.parts.some((p) => p.itemId === itemId) || r.works.some((w) => w.itemId === itemId)))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.odometer ?? -1) - (a.odometer ?? -1))
}

/** История узла по машине: сначала запчасти, потом работы каждой записи; новые записи сверху. */
export function itemHistory(records: CarRecord[], itemId: ID): ItemHistoryEntry[] {
  const recs = serviceRecordsWith(records, itemId)
  const out: ItemHistoryEntry[] = []
  recs.forEach((r, index) => {
    const prev = recs[index + 1]
    const common: Pick<ItemHistoryEntry, 'recordId' | 'date' | 'odometer' | 'placeId' | 'sinceKm' | 'sinceDays'> = {
      recordId: r.id, date: r.date,
    }
    if (r.odometer !== undefined) common.odometer = r.odometer
    if (r.placeId) common.placeId = r.placeId
    if (prev) {
      if (r.odometer !== undefined && prev.odometer !== undefined) common.sinceKm = r.odometer - prev.odometer
      common.sinceDays = diffDays(prev.date, r.date)
    }
    for (const p of r.parts) {
      if (p.itemId !== itemId) continue
      const e: ItemHistoryEntry = { ...common, line: 'part', name: p.name }
      if (p.brand) e.brand = p.brand
      if (p.partNumber) e.partNumber = p.partNumber
      if (p.unitPrice !== undefined) e.price = lineTotal(p)
      if (r.masterId) e.masterId = r.masterId
      out.push(e)
    }
    for (const w of r.works) {
      if (w.itemId !== itemId) continue
      const e: ItemHistoryEntry = { ...common, line: 'work', name: w.name }
      if (w.price !== undefined) e.price = lineTotal(w)
      const masterId = w.masterId ?? r.masterId
      if (masterId) e.masterId = masterId
      out.push(e)
    }
  })
  return out
}

export interface LastPart {
  recordId: ID
  date: ISODate
  line: PartLine
}

/** Последняя запчасть для узла — подсказка «В прошлый раз: Mann W 712/95, 650 ₽». */
export function lastPartFor(records: CarRecord[], itemId: ID): LastPart | null {
  for (const r of serviceRecordsWith(records, itemId)) {
    const line = r.parts.find((p) => p.itemId === itemId)
    if (line) return { recordId: r.id, date: r.date, line }
  }
  return null
}
