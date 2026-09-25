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

test('сбой сида каталога не мешает запустить синхронизацию', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const broken = {
    catalogItems: {
      toCollection() {
        throw new Error('IndexedDB недоступна')
      },
    },
  } as unknown as MyAutoDB
  const initSync = vi.fn(async () => {})
  await expect(initApp({ db: broken, initSync })).resolves.toBeUndefined()
  expect(initSync).toHaveBeenCalledOnce()
  expect(warn).toHaveBeenCalled()
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
