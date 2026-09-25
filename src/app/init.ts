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
 * Сбои не ломают запуск — только предупреждение в консоли: без сида экраны всё равно видят встроенный
 * каталог (хуки подмешивают его), а синхронизация (нет сети, Диск недоступен) повторит попытку сама.
 */
export async function initApp(deps: InitDeps = {}): Promise<void> {
  const { db = appDb, initSync = appInitSync } = deps
  try {
    await ensureSeed(db, BUILTIN_CATALOG)
  } catch (e) {
    console.warn('Встроенный каталог не записан в базу', e)
  }
  try {
    await initSync()
  } catch (e) {
    console.warn('Синхронизация не запустилась', e)
  }
}
