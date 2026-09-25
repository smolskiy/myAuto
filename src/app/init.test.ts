import { afterEach, expect, test, vi } from 'vitest'
import { MyAutoDB } from '../db/schema'
import { BUILTIN_CATALOG } from '../domain/catalog'
import { initApp } from './init'

const db = new MyAutoDB(`t-${crypto.randomUUID()}`)
afterEach(async () => {
  await db.catalogItems.clear()
})

test('засевает каталог и запускает синхронизацию', async () => {
  const initSync = vi.fn(async () => {})
  await initApp({ db, initSync })
  expect(await db.catalogItems.count()).toBe(BUILTIN_CATALOG.length)
  expect(initSync).toHaveBeenCalledOnce()
})

test('сбой синхронизации не ломает запуск', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  await expect(
    initApp({
      db,
      initSync: async () => {
        throw new Error('нет сети')
      },
    }),
  ).resolves.toBeUndefined()
})
