import { monthKey } from '../../domain/dates'
import type { CarRecord, Kopecks } from '../../domain/types'

export interface MonthGroup {
  /** 'YYYY-MM' */
  month: string
  /** Сумма записей месяца (у пробега и заметки 0). */
  total: Kopecks
  records: CarRecord[]
}

/** Лента журнала по месяцам: месяцы от новых к старым, записи внутри — в порядке входа. */
export function groupByMonth(records: CarRecord[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>()
  for (const r of records) {
    const month = monthKey(r.date)
    let g = groups.get(month)
    if (!g) {
      g = { month, total: 0, records: [] }
      groups.set(month, g)
    }
    g.records.push(r)
    g.total += r.total
  }
  return [...groups.values()].sort((a, b) => b.month.localeCompare(a.month))
}
