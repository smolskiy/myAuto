import type { CarRecord, CatalogItem, ID, Master, Place } from '../types'
import { EXPENSE_TITLES } from './reminders'

export interface SearchLookup {
  places: Map<ID, Place>
  masters: Map<ID, Master>
  catalog: Map<ID, CatalogItem>
}

/** Нижний регистр, ё → е, лишние пробелы убраны. */
export function normalizeText(s: string): string {
  return s.toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ').trim()
}

function haystack(r: CarRecord, lookup: SearchLookup): string {
  const parts: (string | undefined)[] = [r.note]
  const place = (id?: ID) => (id ? lookup.places.get(id)?.name : undefined)
  const master = (id?: ID) => (id ? lookup.masters.get(id)?.name : undefined)
  const item = (id?: ID) => (id ? lookup.catalog.get(id)?.name : undefined)
  parts.push(place(r.placeId))
  switch (r.kind) {
    case 'service':
      parts.push(r.title, master(r.masterId))
      for (const w of r.works) parts.push(w.name, w.note, item(w.itemId), master(w.masterId))
      for (const p of r.parts) {
        parts.push(p.name, p.brand, p.partNumber, p.supplierName, p.note, item(p.itemId), place(p.supplierPlaceId))
      }
      break
    case 'expense':
      parts.push(r.title, EXPENSE_TITLES[r.category], r.docNumber)
      break
    case 'fuel':
      parts.push(r.fuelGrade)
      break
    case 'note':
      parts.push(r.title)
      break
  }
  return normalizeText(parts.filter(Boolean).join('\n'))
}

/**
 * Поиск по журналу: название и заметка записи, строки работ и запчастей (название, бренд, артикул),
 * места и мастера. Все слова запроса должны найтись; регистр и ё/е не важны. Пустой запрос — все живые записи.
 */
export function searchRecords(records: CarRecord[], query: string, lookup: SearchLookup): CarRecord[] {
  const words = normalizeText(query).split(' ').filter(Boolean)
  const live = records.filter((r) => !r.deleted)
  if (words.length === 0) return live
  return live.filter((r) => {
    const text = haystack(r, lookup)
    return words.every((w) => text.includes(w))
  })
}
