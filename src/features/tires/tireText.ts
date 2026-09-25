import { repos } from '../../db/repos'
import { NBSP } from '../../domain/format'
import type { TireSet } from '../../domain/types'
import { TIRE_SEASON_LABELS } from '../common'

/** DOT — четыре цифры: неделя (01–53) и две последние цифры года. */
const DOT = /^(\d{2})(\d{2})$/

/** «2423» → «2023, 24 неделя»; не код даты — undefined. */
export function formatDot(dot: string | undefined): string | undefined {
  const m = dot?.trim().match(DOT)
  if (!m) return undefined
  const week = Number(m[1])
  if (week < 1 || week > 53) return undefined
  return `20${m[2]}, ${week}${NBSP}неделя`
}

/** «Nokian Hakkapeliitta 10 · 205/55 R16»; без бренда и модели — сезон. */
export function tireSetTitle(set: Pick<TireSet, 'brand' | 'model' | 'size' | 'season'>): string {
  const name =
    [set.brand?.trim(), set.model?.trim()].filter(Boolean).join(' ') || TIRE_SEASON_LABELS[set.season]
  return [name, set.size?.trim()].filter(Boolean).join(' · ')
}

/** «Зимние · шипы · DOT 2023, 24 неделя». */
export function tireSetSubtitle(set: TireSet): string {
  const dot = formatDot(set.dot)
  return [
    TIRE_SEASON_LABELS[set.season],
    set.studded ? 'шипы' : undefined,
    dot ? `DOT ${dot}` : set.dot?.trim() ? `DOT ${set.dot.trim()}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * На машине один установленный комплект: прочие установленные этой машины уходят «на хранение».
 * Вызывается после сохранения комплекта со статусом «установлен» и из «Отметить установленным».
 * Возвращает, сколько комплектов ушло на хранение.
 */
export async function makeOnlyInstalled(set: Pick<TireSet, 'id' | 'vehicleId'>): Promise<number> {
  const others = (await repos.tireSets.list()).filter(
    (s) => s.vehicleId === set.vehicleId && s.id !== set.id && s.status === 'installed',
  )
  for (const s of others) await repos.tireSets.update(s.id, { status: 'stored' })
  return others.length
}
