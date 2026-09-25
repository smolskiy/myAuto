import { lineTotal } from '../../../domain/calc/lines'
import type { Kopecks, PartLine, WorkLine } from '../../../domain/types'

/** Итог ТО по строкам — сумма `lineTotal`: то же округление, что в статистике и истории узла. */
export function linesTotal(works: WorkLine[], parts: PartLine[]): Kopecks {
  let sum = 0
  for (const w of works) sum += lineTotal(w)
  for (const p of parts) sum += lineTotal(p)
  return sum
}
