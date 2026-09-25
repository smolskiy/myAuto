import type { CarRecord, ID, ServiceRecord } from '../types'

/**
 * Пробег комплекта шин: сумма отрезков от установки (`tireSwap.mountedSetId`) до снятия
 * (или установки другого комплекта). Незакрытый отрезок считается до текущего пробега, если он известен.
 * Переобувки без пробега пропускаются.
 */
export function tireSetMileage(records: CarRecord[], setId: ID, currentOdometer: number | null): number {
  const swaps = records
    .filter(
      (r): r is ServiceRecord =>
        r.kind === 'service' && !r.deleted && !!r.tireSwap && typeof r.odometer === 'number',
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.odometer! - b.odometer!)
  let total = 0
  let start: number | null = null
  for (const r of swaps) {
    const { mountedSetId, removedSetId } = r.tireSwap!
    const odometer = r.odometer!
    if (start !== null && (removedSetId === setId || mountedSetId !== undefined)) {
      total += Math.max(0, odometer - start)
      start = null
    }
    if (mountedSetId === setId) start = odometer
  }
  if (start !== null && currentOdometer !== null) total += Math.max(0, currentOdometer - start)
  return total
}
