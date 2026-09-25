import { formatMoney, formatNumber, NBSP } from '../../domain/format'
import type { PartLine, PartUnit } from '../../domain/types'
import { UNIT_LABELS } from '../common'

/** Сколько знаков нужно количеству: 4 → «4», 4,5 → «4,5», 0,25 → «0,25». */
function qtyDigits(qty: number): number {
  if (Number.isInteger(qty)) return 0
  return Number.isInteger(Math.round(qty * 1000) / 100) ? 1 : 2
}

/** «4 л», «1 шт», «0,5 кг». */
export function formatQty(qty: number, unit: PartUnit): string {
  return `${formatNumber(qty, qtyDigits(qty))}${NBSP}${UNIT_LABELS[unit]}`
}

/** «Mann-Filter · W 712/95 · 1 шт» — бренд, артикул и количество строки запчасти. */
export function partMeta(p: PartLine): string {
  return [p.brand?.trim(), p.partNumber?.trim(), formatQty(p.qty, p.unit)].filter(Boolean).join(' · ')
}

/** «В прошлый раз: Mann-Filter W 712/95, 650 ₽»; у литров и прочего — «900 ₽ за л». Нечего подсказать — null. */
export function lastPartText(line: PartLine): string | null {
  const name = [line.brand?.trim(), line.partNumber?.trim()].filter(Boolean).join(' ')
  const price =
    line.unitPrice !== undefined
      ? `${formatMoney(line.unitPrice)}${line.unit === 'pcs' ? '' : ` за ${UNIT_LABELS[line.unit]}`}`
      : ''
  const text = [name, price].filter(Boolean).join(', ')
  return text ? `В прошлый раз: ${text}` : null
}
