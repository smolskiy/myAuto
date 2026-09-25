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
    if (!r.deleted && typeof r.odometer === 'number') out.push({ id: r.id, date: r.date, odometer: r.odometer })
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
  | { ok: false; reason: 'lessThanEarlier' | 'greaterThanLater'; conflict: { date: ISODate; odometer: number } }

/**
 * Хронология пробега: кандидат сверяется с ближайшей по дате более ранней и более поздней записью
 * (не с «текущим пробегом»), поэтому запись задним числом проверяется честно. Сама правимая запись исключается.
 * Записи той же даты не конфликтуют: порядок внутри дня неизвестен.
 */
export function checkOdometer(
  records: CarRecord[],
  candidate: { id?: ID; date: ISODate; odometer: number },
): OdometerCheck {
  let earlier: Point | null = null
  let later: Point | null = null
  for (const p of points(records)) {
    if (p.id === candidate.id) continue
    if (p.date < candidate.date) {
      if (!earlier || p.date > earlier.date || (p.date === earlier.date && p.odometer > earlier.odometer)) earlier = p
    } else if (p.date > candidate.date) {
      if (!later || p.date < later.date || (p.date === later.date && p.odometer < later.odometer)) later = p
    }
  }
  if (earlier && earlier.odometer > candidate.odometer) {
    return { ok: false, reason: 'lessThanEarlier', conflict: { date: earlier.date, odometer: earlier.odometer } }
  }
  if (later && later.odometer < candidate.odometer) {
    return { ok: false, reason: 'greaterThanLater', conflict: { date: later.date, odometer: later.odometer } }
  }
  return { ok: true }
}
