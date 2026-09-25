import type { ISODate, Kopecks } from './types'

/** Неразрывный пробел: разряды и пробел перед единицей. */
export const NBSP = ' '
const MINUS = '−'

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]
const MONTHS_NOMINATIVE = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

/** Число с разрядами через NBSP, запятой и ровно `fractionDigits` знаками после неё. Минус — U+2212. */
export function formatNumber(n: number, fractionDigits = 0): string {
  const fixed = Math.abs(n).toFixed(fractionDigits)
  const [int = '0', frac] = fixed.split('.')
  const negative = n < 0 && Number(fixed) !== 0
  return `${negative ? MINUS : ''}${groupThousands(int)}${frac ? `,${frac}` : ''}`
}

/** До `maxDigits` знаков после запятой, без хвостовых нулей. */
function formatTrimmed(n: number, maxDigits: number): string {
  const s = formatNumber(n, maxDigits)
  return s.includes(',') ? s.replace(/0+$/, '').replace(/,$/, '') : s
}

export function formatMoney(k: Kopecks): string {
  const digits = k % 100 === 0 ? 0 : 2
  return `${formatNumber(k / 100, digits)}${NBSP}₽`
}

export function formatKm(km: number): string {
  return `${formatNumber(Math.round(km))}${NBSP}км`
}

export function formatLiters(l: number): string {
  return `${formatTrimmed(l, 2)}${NBSP}л`
}

export function formatConsumption(lPer100: number): string {
  return `${formatNumber(lPer100, 1)}${NBSP}л/100${NBSP}км`
}

export function formatDate(d: ISODate, style: 'short' | 'long' = 'short'): string {
  const [y, m, day] = d.split('-')
  if (style === 'short') return `${day}.${m}.${y}`
  return `${Number(day)}${NBSP}${MONTHS_GENITIVE[Number(m) - 1]}${NBSP}${y}`
}

/** 'YYYY-MM' → «Сентябрь 2026». */
export function formatMonth(key: string): string {
  const [y, m] = key.split('-')
  return `${MONTHS_NOMINATIVE[Number(m) - 1]}${NBSP}${y}`
}

/** Русские склонения: [1 день, 2 дня, 5 дней]. Дробные — вторая форма («2,5 дня»). */
export function pluralize(n: number, forms: [string, string, string]): string {
  if (!Number.isInteger(n)) return forms[1]
  const abs = Math.abs(n)
  const mod100 = abs % 100
  const mod10 = abs % 10
  if (mod100 >= 11 && mod100 <= 14) return forms[2]
  if (mod10 === 1) return forms[0]
  if (mod10 >= 2 && mod10 <= 4) return forms[1]
  return forms[2]
}

const DAY_FORMS: [string, string, string] = ['день', 'дня', 'дней']

export function formatDaysLeft(days: number): string {
  if (days === 0) return 'сегодня'
  const abs = Math.abs(days)
  const text = `${formatNumber(abs)}${NBSP}${pluralize(abs, DAY_FORMS)}`
  return days < 0 ? `просрочено на ${text}` : text
}
