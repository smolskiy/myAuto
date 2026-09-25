import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/instance'
import { BUILTIN_CATALOG } from '../../domain/catalog'
import type { CatalogItem, ID, Master, Place } from '../../domain/types'

/** Справочник имён для подписей записей. */
export interface Lookup {
  places: Map<ID, Place>
  masters: Map<ID, Master>
  catalog: Map<ID, CatalogItem>
}

/**
 * Места, мастера и позиции каталога по id — вместе с удалёнными: старая запись продолжает показывать имя
 * места или мастера, удалённого позже. Для списков выбора — `usePlaces` / `useMasters` / `useCatalog`.
 * undefined — ещё грузится.
 */
export function useLookup(): Lookup | undefined {
  return useLiveQuery(async () => {
    const [places, masters, catalogRows] = await Promise.all([
      db.places.toArray(),
      db.masters.toArray(),
      db.catalogItems.toArray(),
    ])
    const catalog = new Map<ID, CatalogItem>(BUILTIN_CATALOG.map((i) => [i.id, i]))
    for (const row of catalogRows) catalog.set(row.id, row)
    return {
      places: new Map(places.map((p) => [p.id, p])),
      masters: new Map(masters.map((m) => [m.id, m])),
      catalog,
    }
  }, [])
}
