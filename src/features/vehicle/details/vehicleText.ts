import { currentOdometer } from '../../../domain/calc/odometer'
import { formatDate, formatKm, formatMoney, formatNumber, NBSP } from '../../../domain/format'
import type { CarRecord, Kopecks, Vehicle } from '../../../domain/types'

/** «Skoda Octavia 2016». */
export function makeModelYear(v: Pick<Vehicle, 'make' | 'model' | 'year'>): string {
  return [v.make, v.model, v.year].filter((p) => p !== undefined && String(p).trim() !== '').join(' ')
}

/** «Skoda Octavia 2016 · А123ВС 77» — подпись строки гаража. */
export function vehicleSubtitle(v: Vehicle): string {
  return [makeModelYear(v), v.plate?.trim()].filter(Boolean).join(' · ')
}

/** «1,4 л · 150 л. с. · CZDA»; пустой двигатель — undefined. */
export function formatEngine(engine: Vehicle['engine']): string | undefined {
  if (!engine) return undefined
  const parts: string[] = []
  if (engine.displacementCc) parts.push(`${formatNumber(engine.displacementCc / 1000, 1)}${NBSP}л`)
  if (engine.powerHp) parts.push(`${formatNumber(engine.powerHp)}${NBSP}л.${NBSP}с.`)
  if (engine.code?.trim()) parts.push(engine.code.trim())
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/** «12.03.2019 · 45 000 км · 1 000 000 ₽» — покупка или продажа; пустая — undefined. */
export function formatDeal(deal: Vehicle['purchase']): string | undefined {
  if (!deal) return undefined
  const parts: string[] = []
  if (deal.date) parts.push(formatDate(deal.date))
  if (deal.odometer !== undefined) parts.push(formatKm(deal.odometer))
  if (deal.price !== undefined) parts.push(formatMoney(deal.price))
  return parts.length > 0 ? parts.join(' · ') : undefined
}

/**
 * Пробег для показа: текущий по записям и покупке, а у проданной — не меньше пробега при продаже
 * (у старой машины записей часто нет, и без этого выходило бы «0 км» с покупки).
 */
export function shownOdometer(v: Vehicle, current: number | null | undefined): number | undefined {
  const known = [current ?? undefined, v.sale?.odometer].filter((n): n is number => n !== undefined)
  return known.length > 0 ? Math.max(...known) : undefined
}

/** «Итого с покупкой и продажей» — или только с тем, что указано. */
export function ownershipTotalLabel(v: Vehicle): string {
  const bought = v.purchase?.price !== undefined
  const sold = v.sale?.price !== undefined
  if (bought && sold) return 'Итого с покупкой и продажей'
  return bought ? 'Итого с покупкой' : 'Итого с продажей'
}

/**
 * Итог владения: расходы за всё время + цена покупки − цена продажи.
 * Ни покупки, ни продажи с ценой — undefined (строка «Итого» не нужна).
 */
export function ownershipTotal(v: Vehicle, expenses: Kopecks): Kopecks | undefined {
  const bought = v.purchase?.price
  const sold = v.sale?.price
  if (bought === undefined && sold === undefined) return undefined
  return expenses + (bought ?? 0) - (sold ?? 0)
}

/**
 * Километры за время владения: от пробега при покупке (иначе — самого малого в записях)
 * до пробега при продаже (иначе — текущего). Нет данных или не больше нуля — null.
 */
export function ownershipKm(v: Vehicle, records: CarRecord[]): number | null {
  let first: number | undefined = v.purchase?.odometer
  if (first === undefined) {
    for (const r of records) {
      if (r.deleted || r.odometer === undefined) continue
      if (first === undefined || r.odometer < first) first = r.odometer
    }
  }
  const last = v.sale?.odometer ?? currentOdometer(records, v)
  if (first === undefined || last === null) return null
  const km = last - first
  return km > 0 ? km : null
}
