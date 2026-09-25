import type { CarRecord, FuelRecord, ID, ISODate, Kopecks } from '../types'

export interface FuelInterval {
  fromId: ID
  toId: ID
  fromDate: ISODate
  toDate: ISODate
  km: number
  liters: number
  lPer100km: number
}

/**
 * Интервалы «полный бак → полный бак» по возрастанию даты. Литры интервала — все заправки (Fⱼ, Fᵢ],
 * включая неполные и без пробега. «Пропустил заправку» рвёт цепочку: интервал до такой заправки не считается.
 * Заправки одного дня идут в порядке ввода (`createdAt`); пробег в сравнение не входит — у части заправок
 * его нет, и сравнение перестало бы быть транзитивным.
 */
export function fuelIntervals(records: CarRecord[]): FuelInterval[] {
  const hasOdo = (f: FuelRecord) => typeof f.odometer === 'number'
  const fills = records
    .filter((r): r is FuelRecord => r.kind === 'fuel' && !r.deleted)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  const out: FuelInterval[] = []
  let start: FuelRecord | null = null
  let liters = 0
  for (const f of fills) {
    if (f.missedBefore) {
      start = f.fullTank && hasOdo(f) ? f : null
      liters = 0
      continue
    }
    if (!start) {
      if (f.fullTank && hasOdo(f)) {
        start = f
        liters = 0
      }
      continue
    }
    liters += f.liters
    if (f.fullTank) {
      if (!hasOdo(f)) {
        // полный бак без пробега — интервал не замкнуть
        start = null
        liters = 0
        continue
      }
      const km = f.odometer! - start.odometer!
      if (km > 0) {
        out.push({ fromId: start.id, toId: f.id, fromDate: start.date, toDate: f.date, km, liters, lPer100km: (liters / km) * 100 })
      }
      start = f
      liters = 0
    }
  }
  return out
}

/** Средний расход, взвешенный по км: Σ литров / Σ км × 100. Интервал входит в период по дате конца. */
export function averageConsumption(
  intervals: FuelInterval[],
  range: { from?: ISODate; to?: ISODate } = {},
): number | null {
  let liters = 0
  let km = 0
  for (const i of intervals) {
    if (range.from && i.toDate < range.from) continue
    if (range.to && i.toDate > range.to) continue
    liters += i.liters
    km += i.km
  }
  return km > 0 ? (liters / km) * 100 : null
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Любые два из трёх (литры, цена литра, сумма) → третье. Литры — до 0,01, деньги — до копейки. */
export function solveFuelTriple(input: {
  liters?: number
  pricePerLiter?: Kopecks
  total?: Kopecks
}): { liters: number; pricePerLiter: Kopecks; total: Kopecks } | null {
  const pos = (v?: number): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
  const { liters, pricePerLiter, total } = input
  if (pos(liters) && pos(pricePerLiter) && pos(total)) return { liters, pricePerLiter, total }
  if (pos(liters) && pos(pricePerLiter)) return { liters, pricePerLiter, total: Math.round(liters * pricePerLiter) }
  if (pos(total) && pos(pricePerLiter)) return { liters: round2(total / pricePerLiter), pricePerLiter, total }
  if (pos(liters) && pos(total)) return { liters, pricePerLiter: Math.round(total / liters), total }
  return null
}
