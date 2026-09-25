import type { CarRecord, ID, ISODate, Kopecks, RecordKind } from '../types'
import { lineTotal } from './lines'

/** Визит — только запись с деньгами: ТО, заправка, расход. Пробег и заметка с местом визитом не считаются. */
const VISIT_KINDS: ReadonlySet<RecordKind> = new Set<RecordKind>(['service', 'fuel', 'expense'])

/**
 * Траты записи у места или null, если запись — не визит к этому месту.
 * Место записи → итог записи; иначе «где купил» у запчастей → сумма этих строк.
 * Одно правило для фильтра журнала по месту и для статистики места.
 */
export function placeSpend(r: CarRecord, placeId: ID): Kopecks | null {
  if (r.deleted || !VISIT_KINDS.has(r.kind)) return null
  if (r.placeId === placeId) return r.total
  if (r.kind !== 'service') return null
  const lines = r.parts.filter((p) => p.supplierPlaceId === placeId)
  return lines.length > 0 ? lines.reduce((s, p) => s + lineTotal(p), 0) : null
}

/**
 * Траты записи у мастера или null. Мастер записи → итог записи; иначе мастер отдельных работ → сумма его работ.
 * Одно правило для фильтра журнала по мастеру и для статистики мастера.
 */
export function masterSpend(r: CarRecord, masterId: ID): Kopecks | null {
  if (r.deleted || r.kind !== 'service') return null
  if (r.masterId === masterId) return r.total
  const works = r.works.filter((w) => w.masterId === masterId)
  return works.length > 0 ? works.reduce((s, w) => s + lineTotal(w), 0) : null
}

export interface VisitStats {
  visits: number
  total: Kopecks
  /** Средний чек, округлён до копейки. */
  average: Kopecks
  lastDate?: ISODate
}

/** Сводка визитов по правилу `spend` (placeSpend / masterSpend). */
export function visitStats(records: CarRecord[], spend: (r: CarRecord) => Kopecks | null): VisitStats {
  let visits = 0
  let total = 0
  let lastDate: ISODate | undefined
  for (const r of records) {
    const amount = spend(r)
    if (amount === null) continue
    visits++
    total += amount
    if (!lastDate || r.date > lastDate) lastDate = r.date
  }
  const stats: VisitStats = { visits, total, average: visits > 0 ? Math.round(total / visits) : 0 }
  if (lastDate) stats.lastDate = lastDate
  return stats
}
