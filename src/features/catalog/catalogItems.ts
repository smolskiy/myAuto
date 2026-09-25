import type { Patch } from '../../db/repo'
import { repos } from '../../db/repos'
import { formatKm, formatNumber, NBSP } from '../../domain/format'
import type { CatalogItem } from '../../domain/types'

/** «каждые 10 000 км / 12 мес.», «каждые 12 мес.» или «без интервала». */
export function intervalText(item: Pick<CatalogItem, 'defaultIntervalKm' | 'defaultIntervalMonths'>): string {
  const parts: string[] = []
  if (item.defaultIntervalKm) parts.push(formatKm(item.defaultIntervalKm))
  if (item.defaultIntervalMonths) parts.push(`${formatNumber(item.defaultIntervalMonths)}${NBSP}мес.`)
  return parts.length > 0 ? `каждые ${parts.join(' / ')}` : 'без интервала'
}

/**
 * Правка позиции каталога. Встроенная позиция может ещё не лежать в базе (приложение досевает каталог при запуске,
 * но строка могла не дойти) — тогда она создаётся с тем же id и правкой пользователя поверх.
 */
export async function saveCatalogItem(item: CatalogItem, patch: Patch<CatalogItem>): Promise<void> {
  if (await repos.catalog.get(item.id)) {
    await repos.catalog.update(item.id, patch)
    return
  }
  const { createdAt: _createdAt, updatedAt: _updatedAt, deleted: _deleted, ...draft } = item
  await repos.catalog.create({ ...draft, ...patch })
}
