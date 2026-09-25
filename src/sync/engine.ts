import type { MyAutoDB } from '../db/schema'
import { SYNC_TABLES } from '../db/schema'
import { applyRows, readSnapshot } from '../db/snapshotIO'
import { subscribeLocalChanges } from '../db/changes'
import { META_KEYS, getMeta, setMeta } from '../db/meta'
import { diffTables, mergeSnapshots, sameSnapshot } from '../domain/merge'
import { SCHEMA_VERSION, SnapshotError, emptySnapshot, parseSnapshot, type Snapshot } from '../domain/snapshot'
import { todayISO } from '../domain/dates'
import type { SyncEngine, SyncStatus } from './contracts'
import { Offline, Unauthorized, YandexError, type DiskClient, type ResourceStat } from './yandex/api'

/**
 * Синхронизация через Яндекс.Диск (спецификация, раздел 6.1).
 *
 * На Диске лежит один файл — полная копия базы вместе с пометками об удалении. Цикл:
 *   1) узнать версию файла (md5) и скачать его;
 *   2) слить со своей базой (domain/merge.ts) и записать себе то, чего не было;
 *   3) если на Диске не то же самое — сверить версию ещё раз и загрузить результат;
 *      версия сменилась (другое устройство успело записать) — начать заново, до 3 попыток;
 *   4) загрузить файлы вложений, удалить с Диска файлы удалённых вложений;
 *   5) раз в день — копия garage.json в backups/, храним 30 последних.
 *
 * Окно между последней сверкой версии и записью без блокировок на Диске не закрыть. Если проигравший
 * цикл всё же перезапишет чужую версию, чужие строки не пропадут: они лежат в базе другого устройства
 * и уйдут на Диск его следующим циклом — слияние коммутативно и идемпотентно.
 */

export const GARAGE_PATH = 'app:/garage.json'
export const BACKUP_DIR = 'app:/backups'
export const BACKUPS_TO_KEEP = 30
const MAX_ATTEMPTS = 3
const BACKUP_NAME = /^\d{4}-\d{2}-\d{2}\.json$/

export interface AttachmentSync {
  uploadPending(disk: DiskClient): Promise<void>
  cleanupDeleted(disk: DiskClient): Promise<void>
  pendingCount(): Promise<number>
}

export interface EngineDeps {
  db: MyAutoDB
  getDisk: () => DiskClient | null
  /** Токен отозван или истёк: стереть его. */
  onUnauthorized?: () => Promise<void>
  attachments?: AttachmentSync
  now?: () => number
  today?: () => string
  isOnline?: () => boolean
  /** Пауза после локальной правки, мс (2500). */
  debounceMs?: number
  /** Период фоновой синхронизации, мс (5 минут). */
  intervalMs?: number
}

/** Ошибка с готовым текстом для человека. */
class SyncFailure extends Error {}

const CORRUPTED = 'Файл синхронизации на Диске повреждён'

function parseRemote(text: string): Snapshot {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new SyncFailure(CORRUPTED)
  }
  try {
    return parseSnapshot(json)
  } catch (e) {
    const version = (json as { schemaVersion?: unknown } | null)?.schemaVersion
    if (e instanceof SnapshotError && typeof version === 'number' && version > SCHEMA_VERSION) throw new SyncFailure(e.message)
    console.warn('Файл синхронизации не прошёл проверку', e)
    throw new SyncFailure(CORRUPTED)
  }
}

/** Версия файла на Диске: md5, а если его нет — время изменения. null — файла нет. */
const revision = (stat: ResourceStat | null): string | null => (stat ? (stat.md5 ?? stat.modified ?? '') : null)

export function createSyncEngine(deps: EngineDeps): SyncEngine {
  const { db } = deps
  const now = deps.now ?? (() => Date.now())
  const today = deps.today ?? (() => todayISO())
  const isOnline = deps.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false)
  const debounceMs = deps.debounceMs ?? 2500
  const intervalMs = deps.intervalMs ?? 5 * 60 * 1000

  let status: SyncStatus = { state: 'off', pendingUploads: 0 }
  const subscribers = new Set<(s: SyncStatus) => void>()
  let running: Promise<void> | null = null
  /** Текст 401: держим его в статусе, пока пользователь не войдёт заново. */
  let authError: string | null = null
  let started = false
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  let cleanups: (() => void)[] = []

  function setStatus(patch: Partial<SyncStatus>): void {
    const next: SyncStatus = { ...status, ...patch }
    if (next.state !== 'error') delete next.error
    status = next
    for (const cb of subscribers) cb(status)
  }

  /** Скачать, слить, записать себе; при необходимости — загрузить на Диск. */
  async function syncGarage(disk: DiskClient): Promise<void> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const before = await disk.stat(GARAGE_PATH)
      const text = before ? await disk.readText(GARAGE_PATH) : null
      const remote = text === null ? emptySnapshot(0) : parseRemote(text)

      // Чтение, слияние и запись — одной транзакцией: правка пользователя не вклинится между ними.
      const merged = await db.transaction('rw', SYNC_TABLES.map((name) => db.table(name)), async () => {
        const local = await readSnapshot(db, now())
        const result = mergeSnapshots(local, remote)
        await applyRows(db, diffTables(local.tables, result.tables))
        return result
      })

      if (text !== null && sameSnapshot(merged, remote)) return
      const check = await disk.stat(GARAGE_PATH)
      if (revision(check) !== revision(before)) continue // другое устройство успело записать — заново
      await disk.writeText(GARAGE_PATH, JSON.stringify(merged))
      return
    }
    throw new SyncFailure('Не удалось синхронизироваться — повторите позже')
  }

  /** Раз в сутки — копия на стороне Диска. Сбой копии не ломает синхронизацию: повторим следующим циклом. */
  async function dailyBackup(disk: DiskClient): Promise<void> {
    const day = today()
    if ((await getMeta<string | null>(db, META_KEYS.lastBackupDate, null)) === day) return
    try {
      await disk.ensureFolder(BACKUP_DIR)
      await disk.copy(GARAGE_PATH, `${BACKUP_DIR}/${day}.json`)
      const names = (await disk.list(BACKUP_DIR)).filter((n) => BACKUP_NAME.test(n)).sort()
      for (const name of names.slice(0, Math.max(0, names.length - BACKUPS_TO_KEEP))) {
        await disk.remove(`${BACKUP_DIR}/${name}`)
      }
      await setMeta(db, META_KEYS.lastBackupDate, day)
    } catch (e) {
      console.warn('Резервная копия на Диске не сохранилась', e)
    }
  }

  async function refreshPending(): Promise<void> {
    if (!deps.attachments) return
    try {
      const pendingUploads = await deps.attachments.pendingCount()
      if (pendingUploads !== status.pendingUploads) setStatus({ pendingUploads })
    } catch (e) {
      console.warn('Не удалось посчитать неотправленные файлы', e)
    }
  }

  async function cycle(): Promise<void> {
    const disk = deps.getDisk()
    if (!disk) {
      setStatus(authError ? { state: 'error', error: authError } : { state: 'off' })
      await refreshPending()
      return
    }
    authError = null
    if (!isOnline()) {
      setStatus({ state: 'offline' })
      await refreshPending()
      return
    }
    setStatus({ state: 'syncing' })
    try {
      await syncGarage(disk)
      if (deps.attachments) {
        await deps.attachments.uploadPending(disk)
        await deps.attachments.cleanupDeleted(disk)
      }
      await dailyBackup(disk)
      const at = now()
      await setMeta(db, META_KEYS.lastSyncAt, at)
      const pendingUploads = deps.attachments ? await deps.attachments.pendingCount() : 0
      setStatus({ state: 'idle', lastSyncAt: at, pendingUploads })
    } catch (e) {
      if (e instanceof Unauthorized) {
        authError = e.message
        try {
          await deps.onUnauthorized?.()
        } catch (err) {
          console.warn('Не удалось стереть токен', err)
        }
        setStatus({ state: 'error', error: e.message })
      } else if (e instanceof Offline) {
        setStatus({ state: 'offline' })
      } else if (e instanceof YandexError || e instanceof SyncFailure) {
        setStatus({ state: 'error', error: e.message })
      } else {
        console.warn('Синхронизация не удалась', e)
        setStatus({ state: 'error', error: 'Синхронизация не удалась — повторите позже' })
      }
      await refreshPending()
    }
  }

  function syncNow(): Promise<void> {
    if (running) return running
    running = cycle().finally(() => {
      running = null
    })
    return running
  }

  /** Серия правок уходит одним файлом; правка во время идущего цикла — следующим циклом. */
  function scheduleAfterChange(): void {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      if (running) void running.then(() => syncNow())
      else void syncNow()
    }, debounceMs)
  }

  return {
    getStatus: () => status,

    subscribe(cb) {
      subscribers.add(cb)
      return () => {
        subscribers.delete(cb)
      }
    },

    syncNow: () => syncNow(),

    start() {
      if (started) return
      started = true
      const onVisible = () => {
        if (document.visibilityState === 'visible') void syncNow()
      }
      const onOnline = () => void syncNow()
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('online', onOnline)
      const interval = setInterval(() => {
        if (document.visibilityState !== 'hidden') void syncNow()
      }, intervalMs)
      const unsubscribe = subscribeLocalChanges(scheduleAfterChange)
      cleanups = [
        unsubscribe,
        () => document.removeEventListener('visibilitychange', onVisible),
        () => window.removeEventListener('online', onOnline),
        () => clearInterval(interval),
        () => clearTimeout(debounceTimer),
      ]
      void getMeta<number | null>(db, META_KEYS.lastSyncAt, null).then((last) => {
        if (last !== null && status.lastSyncAt === undefined) setStatus({ lastSyncAt: last })
      })
      void syncNow()
    },

    stop() {
      for (const cleanup of cleanups) cleanup()
      cleanups = []
      started = false
    },
  }
}
