/**
 * Справочник СТО и АЗС по городам: автосервисы, шиномонтажи и заправки с адресами и телефонами из Яндекс Карт. Только подсказки —
 * выбранное становится своим местом. Данные — `directory/<город>.json` (грузятся по требованию, `tools/place-directory.py`).
 */
import type { Place, PlaceKind } from './types'

export type DirectoryCityId = 'rostov' | 'evpatoria'

export const DIRECTORY_CITIES: { id: DirectoryCityId; name: string }[] = [
  { id: 'rostov', name: 'Ростов-на-Дону' },
  { id: 'evpatoria', name: 'Евпатория' },
]

export const isDirectoryCity = (s: unknown): s is DirectoryCityId => DIRECTORY_CITIES.some((c) => c.id === s)

export const directoryCityName = (id: DirectoryCityId): string =>
  DIRECTORY_CITIES.find((c) => c.id === id)?.name ?? id

/**
 * Строка файла: название, адрес (без города), телефоны через «; », вид ('s' — СТО, 't' — шины, 'f' — АЗС), id организации на
 * Яндекс Картах, её seoname (для ссылки). Популярные (по числу оценок) — первыми.
 */
export type DirectoryRow = [string, string, string, 's' | 't' | 'f', string, string]

export interface DirectoryFile {
  city: string
  /** Когда собраны данные, YYYY-MM-DD. */
  updated: string
  source: string
  places: DirectoryRow[]
}

export type DirectoryKind = 'service' | 'tire' | 'fuel'

export interface DirectoryPlace {
  /** id организации на Яндекс Картах. */
  id: string
  name: string
  /** Без города; '' — точного адреса нет. */
  address: string
  phones: string[]
  kind: DirectoryKind
  /** Карточка организации на Яндекс Картах. */
  url: string
}

const KINDS: Record<DirectoryRow[3], DirectoryKind> = { s: 'service', t: 'tire', f: 'fuel' }

export function parseDirectory(file: DirectoryFile): DirectoryPlace[] {
  return file.places.map(([name, address, phones, kind, id, seo]) => ({
    id,
    name,
    address,
    phones: phones ? phones.split('; ') : [],
    kind: KINDS[kind],
    url: `https://yandex.ru/maps/org/${seo || 'org'}/${id}/`,
  }))
}

/** Для сравнения: регистр, «ё» и лишние пробелы не важны. */
const norm = (s: string | undefined) =>
  (s ?? '').trim().toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ')

/**
 * Каждое слово запроса — в названии или адресе, в любом порядке. Совпавшие по названию — выше; дальше порядок
 * файла (популярные первыми). Пустой запрос — все.
 */
export function searchDirectory(
  places: DirectoryPlace[],
  query: string,
  limit?: number,
  kind?: DirectoryKind,
): DirectoryPlace[] {
  const words = norm(query).split(' ').filter(Boolean)
  const byName: DirectoryPlace[] = []
  const byAddress: DirectoryPlace[] = []
  for (const p of places) {
    if (kind && p.kind !== kind) continue
    const name = norm(p.name)
    const text = `${name} ${norm(p.address)}`
    if (!words.every((w) => text.includes(w))) continue
    ;(words.every((w) => name.includes(w)) ? byName : byAddress).push(p)
  }
  const found = [...byName, ...byAddress]
  return limit === undefined ? found : found.slice(0, limit)
}

/** Место справочника уже среди своих: та же ссылка или то же название с тем же адресом. */
export function isKnownPlace(
  entry: DirectoryPlace,
  places: readonly Pick<Place, 'name' | 'address' | 'url'>[],
): boolean {
  return places.some(
    (p) =>
      p.url?.trim() === entry.url ||
      (norm(p.name) === norm(entry.name) && norm(p.address) === norm(entry.address)),
  )
}

/** Своё место из справочника: вид — справочника или заданный, телефон — первый. */
export function placeFromDirectory(
  entry: DirectoryPlace,
  kind: PlaceKind = entry.kind,
): Pick<Place, 'kind' | 'name' | 'address' | 'phone' | 'url'> {
  return {
    kind,
    name: entry.name,
    address: entry.address || undefined,
    phone: entry.phones[0],
    url: entry.url,
  }
}
