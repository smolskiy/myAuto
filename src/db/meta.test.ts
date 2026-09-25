import { afterAll, afterEach, expect, test } from 'vitest'
import { MyAutoDB } from './schema'
import { META_KEYS, deleteMeta, getMeta, setMeta } from './meta'

const db = new MyAutoDB(`t-${crypto.randomUUID()}`)
afterEach(async () => {
  await db.meta.clear()
})
afterAll(async () => {
  await db.delete()
})

test('настройки устройства', async () => {
  expect(await getMeta(db, META_KEYS.theme, 'system')).toBe('system')
  await setMeta(db, META_KEYS.theme, 'dark')
  expect(await getMeta(db, META_KEYS.theme, 'system')).toBe('dark')
  await deleteMeta(db, META_KEYS.theme)
  expect(await getMeta(db, META_KEYS.theme, 'system')).toBe('system')
})
