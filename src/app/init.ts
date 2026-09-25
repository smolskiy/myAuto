import { db as appDb } from '../db/instance'
import type { MyAutoDB } from '../db/schema'
import { ensureSeed } from '../db/seed'
import { BUILTIN_CATALOG } from '../domain/catalog'
import { initSync as appInitSync } from '../sync/index'

export interface InitDeps {
  db?: MyAutoDB
  initSync?: () => Promise<void>
}

/**
 * Запуск приложения: досевает встроенный каталог, затем запускает синхронизацию.
 * Сбой синхронизации (нет сети, Диск недоступен) запуск не ломает — только предупреждение в консоли.
 */
export async function initApp(deps: InitDeps = {}): Promise<void> {
  const { db = appDb, initSync = appInitSync } = deps
  await ensureSeed(db, BUILTIN_CATALOG)
  try {
    await initSync()
  } catch (e) {
    console.warn('Синхронизация не запустилась', e)
  }
}
