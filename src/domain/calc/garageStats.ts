import { monthKey } from '../dates'
import type { CarRecord, CatalogItem, ID, ISODate, Kopecks, ServiceRecord } from '../types'
import { lineTotal } from './lines'
import { masterSpend } from './visits'

/** Статистика обслуживания и запчастей за период («Статистика → Сервис», «→ Запчасти»). */

type Range = { from?: ISODate; to?: ISODate }

const inRange = (d: ISODate, range: Range) => (!range.from || d >= range.from) && (!range.to || d <= range.to)

/** Живые записи ТО периода. */
function services(records: CarRecord[], range: Range): ServiceRecord[] {
  return records.filter(
    (r): r is ServiceRecord => r.kind === 'service' && !r.deleted && inRange(r.date, range),
  )
}

/** Работы и запчасти записи; остаток итога (скидка, строки без цен) — «прочее», как в стоимости владения. */
function split(r: ServiceRecord) {
  const labor = r.works.reduce((s, w) => s + lineTotal(w), 0)
  const parts = r.parts.reduce((s, p) => s + lineTotal(p), 0)
  return { labor, parts, other: r.total - labor - parts }
}

const byTotalDesc = <T extends { total: Kopecks }>(a: T, b: T) => b.total - a.total

// ——— Сервис ———

export interface PlaceRow {
  /** id места, 'diy' — «делал сам», 'none' — место не указано. */
  key: string
  placeId?: ID
  diy: boolean
  total: Kopecks
  labor: Kopecks
  parts: Kopecks
  visits: number
  lastDate: ISODate
}

export interface MasterRow {
  masterId: ID
  total: Kopecks
  visits: number
  lastDate: ISODate
}

export interface ServiceMonth {
  month: string
  labor: Kopecks
  parts: Kopecks
  other: Kopecks
}

export interface ServiceStats {
  total: Kopecks
  labor: Kopecks
  parts: Kopecks
  other: Kopecks
  visits: number
  byPlace: PlaceRow[]
  byMaster: MasterRow[]
  byMonth: ServiceMonth[]
}

/**
 * ТО и ремонты периода: работы и запчасти, места (итог записи — месту; «делал сам» — отдельно) и мастера
 * (правило `masterSpend`: мастер записи — её итог, мастер отдельной работы — его работы). Заправки и расходы —
 * не обслуживание, в «Сервис» не входят.
 */
export function serviceStats(records: CarRecord[], range: Range = {}): ServiceStats {
  const out: ServiceStats = {
    total: 0,
    labor: 0,
    parts: 0,
    other: 0,
    visits: 0,
    byPlace: [],
    byMaster: [],
    byMonth: [],
  }
  const places = new Map<string, PlaceRow>()
  const masters = new Map<ID, MasterRow>()
  const months = new Map<string, ServiceMonth>()
  const later = (a: ISODate, b: ISODate) => (b > a ? b : a)

  for (const r of services(records, range)) {
    const { labor, parts, other } = split(r)
    out.total += r.total
    out.labor += labor
    out.parts += parts
    out.other += other
    out.visits++

    const key = r.diy ? 'diy' : (r.placeId ?? 'none')
    const place = places.get(key) ?? {
      key,
      ...(!r.diy && r.placeId && { placeId: r.placeId }),
      diy: r.diy,
      total: 0,
      labor: 0,
      parts: 0,
      visits: 0,
      lastDate: r.date,
    }
    place.total += r.total
    place.labor += labor
    place.parts += parts
    place.visits++
    place.lastDate = later(place.lastDate, r.date)
    places.set(key, place)

    const ids = new Set([r.masterId, ...r.works.map((w) => w.masterId)].filter((id): id is ID => !!id))
    for (const id of ids) {
      const amount = masterSpend(r, id)
      if (amount === null) continue
      const m = masters.get(id) ?? { masterId: id, total: 0, visits: 0, lastDate: r.date }
      m.total += amount
      m.visits++
      m.lastDate = later(m.lastDate, r.date)
      masters.set(id, m)
    }

    const mk = monthKey(r.date)
    const month = months.get(mk) ?? { month: mk, labor: 0, parts: 0, other: 0 }
    month.labor += labor
    month.parts += parts
    month.other += other
    months.set(mk, month)
  }

  out.byPlace = [...places.values()].sort(byTotalDesc)
  out.byMaster = [...masters.values()].sort(byTotalDesc)
  out.byMonth = [...months.values()].sort((a, b) => a.month.localeCompare(b.month))
  return out
}

// ——— Запчасти ———

export interface ItemRow {
  /** id узла каталога или 'name:<название>' для строк без узла. */
  key: string
  itemId?: ID
  name: string
  /** Запчасти и работы по узлу. */
  total: Kopecks
  /** Записей с этим узлом. */
  replacements: number
  /** Бренды запчастей узла, частые первыми. */
  brands: string[]
  /** Средний пробег между заменами (нужно две записи с пробегом). */
  avgKmBetween: number | null
  lastDate: ISODate
}

export interface BrandRow {
  brand: string
  lines: number
  total: Kopecks
}

export interface SupplierRow {
  /** id магазина, 'own' — «купил сам» без магазина, 'service' — запчасти сервиса. */
  key: string
  placeId?: ID
  total: Kopecks
  /** Записей с покупками здесь. */
  purchases: number
}

export interface PartsStats {
  total: Kopecks
  /** Купил сам. */
  own: Kopecks
  /** Запчасти сервиса. */
  service: Kopecks
  byItem: ItemRow[]
  byBrand: BrandRow[]
  bySupplier: SupplierRow[]
}

const norm = (s: string) => s.trim().toLowerCase().replaceAll('ё', 'е')

/** Самое частое написание (при равенстве — первое встреченное). */
function commonSpelling(counts: Map<string, number>): string {
  let best = ''
  let n = 0
  for (const [spelling, count] of counts) if (count > n) [best, n] = [spelling, count]
  return best
}

/**
 * Запчасти периода: узлы (запчасти + работы по узлу; строки без узла — по названию), бренды (без учёта регистра)
 * и где куплены (магазин «где купил», «купил сам» без магазина, запчасти сервиса).
 */
export function partsStats(records: CarRecord[], range: Range, catalog: CatalogItem[]): PartsStats {
  const out: PartsStats = { total: 0, own: 0, service: 0, byItem: [], byBrand: [], bySupplier: [] }
  const names = new Map(catalog.map((i) => [i.id, i.name]))
  const items = new Map<string, ItemRow & { odometers: number[]; brandCounts: Map<string, number> }>()
  const brands = new Map<string, { spellings: Map<string, number>; lines: number; total: Kopecks }>()
  const suppliers = new Map<string, SupplierRow>()

  for (const r of services(records, range)) {
    const seenItems = new Set<string>()
    const seenSuppliers = new Set<string>()
    const lines = [
      ...r.parts.map((p) => ({ line: p, part: p })),
      ...r.works.map((w) => ({ line: w, part: null })),
    ]
    for (const { line, part } of lines) {
      const amount = lineTotal(line)
      const key = line.itemId ?? `name:${norm(line.name)}`
      const row = items.get(key) ?? {
        key,
        ...(line.itemId && { itemId: line.itemId }),
        name: (line.itemId && names.get(line.itemId)) || line.name.trim(),
        total: 0,
        replacements: 0,
        brands: [],
        avgKmBetween: null,
        lastDate: r.date,
        odometers: [] as number[],
        brandCounts: new Map<string, number>(),
      }
      row.total += amount
      if (!seenItems.has(key)) {
        seenItems.add(key)
        row.replacements++
        if (r.date > row.lastDate) row.lastDate = r.date
        if (r.odometer !== undefined) row.odometers.push(r.odometer)
      }
      items.set(key, row)
      if (!part) continue

      out.total += amount
      if (part.ownPart) out.own += amount
      else out.service += amount

      const brand = part.brand?.trim()
      if (brand) {
        row.brandCounts.set(brand, (row.brandCounts.get(brand) ?? 0) + 1)
        const b = brands.get(norm(brand)) ?? { spellings: new Map(), lines: 0, total: 0 }
        b.spellings.set(brand, (b.spellings.get(brand) ?? 0) + 1)
        b.lines++
        b.total += amount
        brands.set(norm(brand), b)
      }

      const sk = !part.ownPart ? 'service' : (part.supplierPlaceId ?? 'own')
      const s = suppliers.get(sk) ?? {
        key: sk,
        ...(part.ownPart && part.supplierPlaceId && { placeId: part.supplierPlaceId }),
        total: 0,
        purchases: 0,
      }
      s.total += amount
      if (!seenSuppliers.has(sk)) {
        seenSuppliers.add(sk)
        s.purchases++
      }
      suppliers.set(sk, s)
    }
  }

  out.byItem = [...items.values()]
    .map(({ odometers, brandCounts, ...row }) => {
      const sorted = [...odometers].sort((a, b) => a - b)
      const span = sorted.length >= 2 ? sorted[sorted.length - 1]! - sorted[0]! : null
      // Бренды — без учёта регистра, частые первыми, в самом частом написании.
      const byBrand = new Map<string, Map<string, number>>()
      for (const [spelling, count] of brandCounts) {
        const spellings = byBrand.get(norm(spelling)) ?? new Map<string, number>()
        spellings.set(spelling, count)
        byBrand.set(norm(spelling), spellings)
      }
      const brandList = [...byBrand.values()]
        .map((spellings) => ({
          name: commonSpelling(spellings),
          n: [...spellings.values()].reduce((a, b) => a + b, 0),
        }))
        .sort((a, b) => b.n - a.n)
        .map((b) => b.name)
      return {
        ...row,
        brands: brandList,
        avgKmBetween: span !== null ? Math.round(span / (sorted.length - 1)) : null,
      }
    })
    .sort(byTotalDesc)
  out.byBrand = [...brands.values()]
    .map((b) => ({ brand: commonSpelling(b.spellings), lines: b.lines, total: b.total }))
    .sort(byTotalDesc)
  out.bySupplier = [...suppliers.values()].sort(byTotalDesc)
  return out
}
