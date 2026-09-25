import { diffDays, monthKey } from '../dates'
import type { CarRecord, ExpenseCategory, ISODate, Kopecks } from '../types'
import { lineTotal } from './lines'

export type CostGroup = 'parts' | 'labor' | 'serviceOther' | 'fuel' | ExpenseCategory

export const COST_GROUP_LABELS: Record<CostGroup, string> = {
  parts: 'Запчасти',
  labor: 'Работы',
  serviceOther: 'ТО и ремонт (без детализации)',
  fuel: 'Топливо',
  osago: 'ОСАГО',
  kasko: 'КАСКО',
  tax: 'Налог',
  fine: 'Штрафы',
  wash: 'Мойка',
  parking: 'Парковка',
  toll: 'Платные дороги',
  tireService: 'Шиномонтаж',
  tireStorage: 'Хранение шин',
  inspection: 'Техосмотр',
  accessories: 'Аксессуары',
  registration: 'Регистрация',
  other: 'Прочее',
}

type ByGroup = Partial<Record<CostGroup, Kopecks>>

export interface CostBreakdown {
  total: Kopecks
  byGroup: ByGroup
  byMonth: { month: string; total: Kopecks; byGroup: ByGroup }[]
}

type Range = { from?: ISODate; to?: ISODate }

const inRange = (d: ISODate, range: Range) => (!range.from || d >= range.from) && (!range.to || d <= range.to)

/** Суммы записи по группам. Итог записи ТО — истина: остаток после строк (в т. ч. отрицательный при скидке) — serviceOther. */
function recordGroups(r: CarRecord): [CostGroup, Kopecks][] {
  switch (r.kind) {
    case 'service': {
      const parts = r.parts.reduce((s, p) => s + lineTotal(p), 0)
      const labor = r.works.reduce((s, w) => s + lineTotal(w), 0)
      return [['parts', parts], ['labor', labor], ['serviceOther', r.total - parts - labor]]
    }
    case 'fuel':
      return [['fuel', r.total]]
    case 'expense':
      return [[r.category, r.total]]
    default:
      return []
  }
}

function add(target: ByGroup, group: CostGroup, amount: Kopecks) {
  if (amount === 0) return
  const next = (target[group] ?? 0) + amount
  if (next === 0) delete target[group]
  else target[group] = next
}

/** Стоимость владения за период (границы включены): по группам и по месяцам (по возрастанию). */
export function costBreakdown(records: CarRecord[], range: Range = {}): CostBreakdown {
  const out: CostBreakdown = { total: 0, byGroup: {}, byMonth: [] }
  const months = new Map<string, CostBreakdown['byMonth'][number]>()
  for (const r of records) {
    if (r.deleted || !inRange(r.date, range)) continue
    const groups = recordGroups(r)
    if (groups.length === 0) continue
    const key = monthKey(r.date)
    let month = months.get(key)
    if (!month) {
      month = { month: key, total: 0, byGroup: {} }
      months.set(key, month)
    }
    for (const [group, amount] of groups) {
      add(out.byGroup, group, amount)
      add(month.byGroup, group, amount)
      out.total += amount
      month.total += amount
    }
  }
  out.byMonth = [...months.values()].sort((a, b) => a.month.localeCompare(b.month))
  return out
}

/** Пробег по датам: для каждой даты — наименьший (начало дня) и наибольший (конец дня) пробег живых записей. */
interface DayOdometer {
  date: ISODate
  min: number
  max: number
}

function odometerByDay(records: CarRecord[]): DayOdometer[] {
  const days = new Map<ISODate, DayOdometer>()
  for (const r of records) {
    if (r.deleted || typeof r.odometer !== 'number') continue
    const day = days.get(r.date)
    if (!day) days.set(r.date, { date: r.date, min: r.odometer, max: r.odometer })
    else {
      day.min = Math.min(day.min, r.odometer)
      day.max = Math.max(day.max, r.odometer)
    }
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Пробег на дату: линейная интерполяция по дням между соседними точками; вне данных — первая/последняя точка.
 * В день с записями: для начала периода — наименьший пробег дня, для конца — наибольший.
 */
function odometerAt(days: DayOdometer[], date: ISODate, bound: 'from' | 'to'): number {
  const first = days[0]!
  const last = days[days.length - 1]!
  if (date < first.date) return first.min
  if (date > last.date) return last.max
  let prev = first
  for (const day of days) {
    if (day.date === date) return bound === 'from' ? day.min : day.max
    if (day.date > date) {
      const share = diffDays(prev.date, date) / diffDays(prev.date, day.date)
      return prev.max + (day.min - prev.max) * share
    }
    prev = day
  }
  return last.max
}

/**
 * Пробег за период (оценка): пробег, интерполированный на `to`, минус интерполированный на `from`;
 * без `from` — первая точка, без `to` — последняя. Результат ≤ 0 или нет данных — null.
 */
export function kmDriven(records: CarRecord[], range: Range = {}): number | null {
  const days = odometerByDay(records)
  if (days.length === 0) return null
  const start = range.from ? odometerAt(days, range.from, 'from') : days[0]!.min
  const end = range.to ? odometerAt(days, range.to, 'to') : days[days.length - 1]!.max
  const km = end - start
  return km > 0 ? km : null
}

/** Цена километра, копеек на км (дробное); без пробега за период — null. */
export function costPerKm(records: CarRecord[], range: Range = {}): number | null {
  const km = kmDriven(records, range)
  return km === null ? null : costBreakdown(records, range).total / km
}
