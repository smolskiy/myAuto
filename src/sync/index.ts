import { db } from '../db/instance'
import { createAttachmentStore } from './attachments'
import { createBackupService } from './backup'
import { createSyncEngine } from './engine'
import { createDiskClient, type DiskClient } from './yandex/api'
import { createYandexAuth } from './yandex/oauth'

/** Боевые экземпляры служб синхронизации. Экраны работают с ними через интерфейсы из contracts.ts. */

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** localStorage, а если браузер его не даёт — память вкладки (вход по коду подтверждения всё равно работает). */
function browserStorage(): KeyValueStorage {
  try {
    const storage = window.localStorage
    storage.getItem(OAUTH_PROBE)
    return storage
  } catch {
    const memory = new Map<string, string>()
    return {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => void memory.set(k, v),
      removeItem: (k) => void memory.delete(k),
    }
  }
}
const OAUTH_PROBE = 'myauto.probe'

let cachedDisk: { token: string; client: DiskClient } | null = null

function getDisk(): DiskClient | null {
  const token = yandexAuth.getToken()
  if (!token) return null
  if (cachedDisk?.token !== token) cachedDisk = { token, client: createDiskClient(token) }
  return cachedDisk.client
}

export const yandexAuth = createYandexAuth({
  db,
  location: window.location,
  storage: browserStorage(),
  envClientId: import.meta.env.VITE_YANDEX_CLIENT_ID,
})

export const attachmentStore = createAttachmentStore({ db, getDisk })

export const syncEngine = createSyncEngine({
  db,
  getDisk,
  attachments: attachmentStore,
  onUnauthorized: () => yandexAuth.disconnect(),
})

export const backupService = createBackupService({ db })

/**
 * Вход — сразу синхронизация; выход — сразу статус `off`. Если выход случился посреди цикла,
 * после него прогоняем ещё один, чтобы статус не остался от прежнего подключения.
 * (Подписка срабатывает и на смену текста ошибки входа — реагируем только на смену подключения.)
 */
let wasConnected = yandexAuth.isConnected()
yandexAuth.subscribe(() => {
  const connected = yandexAuth.isConnected()
  if (connected === wasConnected) return
  wasConnected = connected
  if (connected) void syncEngine.syncNow()
  else void syncEngine.syncNow().then(() => syncEngine.syncNow())
})

let initialized: Promise<void> | null = null

/** Запуск при старте приложения; повторный вызов ничего не делает, а после неудачи — пробует снова. */
export function initSync(): Promise<void> {
  initialized ??= (async () => {
    try {
      await navigator.storage?.persist?.()
    } catch (e) {
      console.warn('Постоянное хранилище не выдано', e)
    }
    await yandexAuth.init()
    await yandexAuth.consumeRedirect() // не бросает: неудача входа — в getLoginError
    syncEngine.start()
  })().catch((e: unknown) => {
    initialized = null
    throw e
  })
  return initialized
}
