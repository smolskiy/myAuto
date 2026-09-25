import { addDays, addMonths } from '../../domain/dates'
import type { ISODate } from '../../domain/types'

export type PeriodKind = 'month' | 'year' | '12m' | 'all'

export const PERIOD_OPTIONS: { value: PeriodKind; label: string }[] = [
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
  { value: '12m', label: '12 мес.' },
  { value: 'all', label: 'Всё время' },
]

/**
 * Границы периода статистики (обе включены), всё — по сегодня: текущий месяц, текущий год,
 * последние 12 месяцев (365–366 дней, заканчиваются сегодня) или вся история (без границ).
 */
export function periodRange(kind: PeriodKind, today: ISODate): { from?: ISODate; to?: ISODate } {
  switch (kind) {
    case 'month':
      return { from: `${today.slice(0, 7)}-01`, to: today }
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today }
    case '12m':
      return { from: addDays(addMonths(today, -12), 1), to: today }
    case 'all':
      return {}
  }
}

/** Месяцы 'YYYY-MM' от `from` до `to` включительно; `from` позже `to` — пусто. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let m = `${from}-01`; m.slice(0, 7) <= to; m = addMonths(m, 1)) out.push(m.slice(0, 7))
  return out
}
