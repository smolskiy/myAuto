import { addDays, diffDays } from '../dates'
import type { CarRecord, ID, ISODate, Vehicle } from '../types'

interface Point {
  id: ID
  date: ISODate
  odometer: number
}

/** Точки (дата, пробег) из живых записей любого вида. */
function points(records: CarRecord[]): Point[] {
  const out: Point[] = []
  for (const r of records) {
    if (!r.deleted && typeof r.odometer === 'number')
      out.push({ id: r.id, date: r.date, odometer: r.odometer })
  }
  return out
}

/** Максимум пробега живых записей и пробега при покупке; null — данных нет. */
export function currentOdometer(records: CarRecord[], vehicle?: Pick<Vehicle, 'purchase'>): number | null {
  let max: number | null = vehicle?.purchase?.odometer ?? null
  for (const p of points(records)) if (max === null || p.odometer > max) max = p.odometer
  return max
}

function spanRate(pts: Point[]): number | null {
  if (pts.length < 2) return null
  let first = pts[0]!.date
  let last = first
  let min = pts[0]!.odometer
  let max = min
  for (const p of pts) {
    if (p.date < first) first = p.date
    if (p.date > last) last = p.date
    if (p.odometer < min) min = p.odometer
    if (p.odometer > max) max = p.odometer
  }
  const days = diffDays(first, last)
  return days >= 14 ? (max - min) / days : null
}

/**
 * Средний пробег в день: по точкам за последние 180 дней, если они покрывают ≥ 14 дней;
 * иначе по всей истории (тоже ≥ 14 дней); иначе null.
 */
export function averageDailyKm(records: CarRecord[], today: ISODate): number | null {
  const all = points(records).filter((p) => p.date <= today)
  const windowStart = addDays(today, -180)
  return spanRate(all.filter((p) => p.date >= windowStart)) ?? spanRate(all)
}

export type OdometerCheck =
  | { ok: true }
  | {
      ok: false
      reason: 'lessThanEarlier' | 'greaterThanLater' | 'sameDayGap'
      conflict: { date: ISODate; odometer: number }
    }

/** Больше такой разницы с записью того же дня за день не проехать — вероятно, опечатка. */
export const SAME_DAY_GAP_KM = 2000

/**
 * Хронология пробега (не «текущий пробег»), поэтому запись задним числом проверяется честно:
 * кандидат не меньше максимума всех более ранних по дате записей и не больше минимума всех более поздних.
 * Записи того же дня — порядок внутри дня неизвестен, поэтому конфликт только при расхождении > 2000 км.
 * Сама правимая запись исключается.
 */
export function checkOdometer(
  records: CarRecord[],
  candidate: { id?: ID; date: ISODate; odometer: number },
): OdometerCheck {
  let earlierMax: Point | null = null
  let laterMin: Point | null = null
  let sameDayFar: Point | null = null
  const gap = (p: Point) => Math.abs(p.odometer - candidate.odometer)
  for (const p of points(records)) {
    if (p.id === candidate.id) continue
    if (p.date < candidate.date) {
      if (!earlierMax || p.odometer > earlierMax.odometer) earlierMax = p
    } else if (p.date > candidate.date) {
      if (!laterMin || p.odometer < laterMin.odometer) laterMin = p
    } else if (gap(p) > SAME_DAY_GAP_KM && (!sameDayFar || gap(p) > gap(sameDayFar))) {
      sameDayFar = p
    }
  }
  const conflict = (p: Point) => ({ date: p.date, odometer: p.odometer })
  if (earlierMax && earlierMax.odometer > candidate.odometer) {
    return { ok: false, reason: 'lessThanEarlier', conflict: conflict(earlierMax) }
  }
  if (laterMin && laterMin.odometer < candidate.odometer) {
    return { ok: false, reason: 'greaterThanLater', conflict: conflict(laterMin) }
  }
  if (sameDayFar) return { ok: false, reason: 'sameDayGap', conflict: conflict(sameDayFar) }
  return { ok: true }
}
