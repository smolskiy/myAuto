import { newId } from '../../../domain/ids'
import type { CarRecord, ID, PartLine, ServiceRecord, ServiceType, WorkLine } from '../../../domain/types'

/** Запчасть в шторке: количество может быть временно пустым, пока его стирают и вводят заново. */
export type PartDraft = Omit<PartLine, 'qty'> & { qty?: number }

export const blankWork = (): WorkLine => ({ id: newId(), name: '' })

export const blankPart = (ownPart: boolean): PartDraft => ({
  id: newId(),
  name: '',
  qty: 1,
  unit: 'pcs',
  ownPart,
})

/** Пустая строка (ни названия, ни узла) в список не попадает. */
export const isBlankLine = (l: { name: string; itemId?: ID }) => !l.name.trim() && !l.itemId

/** Подсказка «в прошлый раз» одним касанием: бренд, артикул, цена, единица и количество. */
export function applyLastPart(line: PartDraft, last: PartLine): PartDraft {
  return {
    ...line,
    name: line.name.trim() ? line.name : last.name,
    brand: last.brand,
    partNumber: last.partNumber,
    unitPrice: last.unitPrice,
    unit: last.unit,
    qty: last.qty,
  }
}

/** Подсказку уже применили (или строка и есть та самая) — больше не предлагать. */
export function matchesLastPart(line: Pick<PartLine, 'brand' | 'partNumber' | 'unitPrice'>, last: PartLine) {
  return line.brand === last.brand && line.partNumber === last.partNumber && line.unitPrice === last.unitPrice
}

const services = (records: CarRecord[], excludeId?: ID) =>
  records
    .filter((r): r is ServiceRecord => r.kind === 'service' && r.id !== excludeId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)

/** Что копирует «Повторить прошлое ТО»: последняя запись с тем же названием, иначе последняя того же типа. */
export function repeatSource(
  records: CarRecord[],
  current: { title: string; serviceType: ServiceType },
  excludeId?: ID,
): ServiceRecord | null {
  const list = services(records, excludeId).filter((r) => r.works.length > 0 || r.parts.length > 0)
  const title = current.title.trim().toLowerCase()
  return (
    (title ? list.find((r) => r.title.trim().toLowerCase() === title) : undefined) ??
    list.find((r) => r.serviceType === current.serviceType) ??
    null
  )
}

/** Строки прошлой записи с новыми id; цены и количества — как были. */
export function copyLines(r: ServiceRecord): { works: WorkLine[]; parts: PartLine[] } {
  return {
    works: r.works.map((w) => ({ ...w, id: newId() })),
    parts: r.parts.map((p) => ({ ...p, id: newId() })),
  }
}

export interface TitleOption {
  title: string
  serviceType: ServiceType
}

const TO_NUMBER = /^ТО-(\d+)$/i

/**
 * Подсказки названия ТО: «ТО-N» (N — число прошлых ТО машины + 1, но не меньше следующего за самым большим
 * «ТО-N» в истории: старую историю часто вносят не с первого ТО), затем прошлые названия по частоте
 * (при равенстве — более свежие). Тип берётся из последней записи с этим названием.
 */
export function titleOptions(records: CarRecord[], excludeId?: ID): TitleOption[] {
  const list = services(records, excludeId)
  const maintenance = list.filter((r) => r.serviceType === 'maintenance')
  const maxNumber = Math.max(0, ...maintenance.map((r) => Number(TO_NUMBER.exec(r.title.trim())?.[1] ?? 0)))
  const next = `ТО-${Math.max(maintenance.length, maxNumber) + 1}`
  const seen = new Map<string, { option: TitleOption; count: number; order: number }>()
  list.forEach((r, order) => {
    const title = r.title.trim()
    if (!title) return
    const key = title.toLowerCase()
    const entry = seen.get(key)
    if (entry) entry.count++
    else seen.set(key, { option: { title, serviceType: r.serviceType }, count: 1, order })
  })
  const past = [...seen.values()]
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .map((e) => e.option)
    .filter((o) => o.title.toLowerCase() !== next.toLowerCase())
  return [{ title: next, serviceType: 'maintenance' }, ...past]
}
