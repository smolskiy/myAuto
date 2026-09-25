import type { MyAutoDB } from './schema'
import type { CatalogItem } from '../domain/types'

/**
 * Добавляет позиции встроенного каталога, id которых нет в таблице.
 * Строка-надгробие (deleted: true) тоже считается «есть» — сид её не воскрешает.
 * Не сообщает о локальном изменении: это не правка пользователя.
 */
export async function ensureSeed(db: MyAutoDB, items: CatalogItem[]): Promise<void> {
  const existingIds = new Set(await db.catalogItems.toCollection().primaryKeys())
  const missing = items.filter((item) => !existingIds.has(item.id))
  if (missing.length > 0) await db.catalogItems.bulkPut(missing)
}
