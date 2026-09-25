import type { Kopecks, PartLine, WorkLine } from '../types'

/**
 * Стоимость строки ТО: запчасть — количество × цена за единицу, округлённая до копейки по строке;
 * работа — её цена. Без цены — 0. Одно правило для формы, статистики и истории узла, чтобы суммы сходились.
 */
export function lineTotal(line: PartLine | WorkLine): Kopecks {
  if ('qty' in line) return Math.round(line.qty * (line.unitPrice ?? 0))
  return line.price ?? 0
}
