import { expect, test } from 'vitest'
import { BUILTIN_CATALOG, CATALOG_ID, ITEM_GROUP_LABELS, STARTER_REMINDER_ITEM_IDS } from './catalog'

test('каталог: стабильные уникальные id и нулевое время', () => {
  const ids = BUILTIN_CATALOG.map((i) => i.id)
  expect(new Set(ids).size).toBe(ids.length)
  expect(BUILTIN_CATALOG.length).toBeGreaterThanOrEqual(35)
  for (const i of BUILTIN_CATALOG) {
    expect(i.id).toMatch(/^item\.[a-z0-9_]+$/)
    expect(i.builtin).toBe(true)
    expect(i.updatedAt).toBe(0)
    expect(i.createdAt).toBe(0)
    expect(ITEM_GROUP_LABELS[i.group]).toBeTruthy()
  }
})

test('ключевые позиции и интервалы', () => {
  const byId = new Map(BUILTIN_CATALOG.map((i) => [i.id, i]))
  expect(byId.get(CATALOG_ID.engineOil)).toMatchObject({ name: 'Моторное масло', defaultIntervalKm: 10000, defaultIntervalMonths: 12 })
  expect(byId.get(CATALOG_ID.oilFilter)).toMatchObject({ defaultIntervalKm: 10000, defaultIntervalMonths: 12 })
  expect(byId.get(CATALOG_ID.brakeFluid)).toMatchObject({ defaultIntervalMonths: 24 })
  for (const id of STARTER_REMINDER_ITEM_IDS) expect(byId.has(id)).toBe(true)
})
