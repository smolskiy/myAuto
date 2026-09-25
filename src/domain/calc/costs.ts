import { monthKey } from '../dates'
import type { CarRecord, ExpenseCategory, ISODate, Kopecks } from '../types'

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
      const parts = Math.round(r.parts.reduce((s, p) => s + p.qty * (p.unitPrice ?? 0), 0))
      const labor = r.works.reduce((s, w) => s + (w.price ?? 0), 0)
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

/** Пробег за период: разница максимального и минимального пробега живых записей периода; < 2 точек — null. */
export function kmDriven(records: CarRecord[], range: Range = {}): number | null {
  let min: number | null = null
  let max: number | null = null
  let count = 0
  for (const r of records) {
    if (r.deleted || typeof r.odometer !== 'number' || !inRange(r.date, range)) continue
    count++
    if (min === null || r.odometer < min) min = r.odometer
    if (max === null || r.odometer > max) max = r.odometer
  }
  return count >= 2 && min !== null && max !== null ? max - min : null
}

/** Цена километра, копеек на км (дробное); без пробега за период — null. */
export function costPerKm(records: CarRecord[], range: Range = {}): number | null {
  const km = kmDriven(records, range)
  if (!km || km <= 0) return null
  return costBreakdown(records, range).total / km
}
