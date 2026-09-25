import type { MyAutoDB } from '../db/schema'
import { SYNC_TABLES } from '../db/schema'
import { applyRows, readSnapshot } from '../db/snapshotIO'
import { subscribeLocalChanges } from '../db/changes'
import { META_KEYS, getMeta, setMeta } from '../db/meta'
import { diffTables, mergeSnapshots, sameSnapshot } from '../domain/merge'
import {
  SCHEMA_VERSION,
  SnapshotError,
  emptySnapshot,
  parseSnapshot,
  type Snapshot,
} from '../domain/snapshot'
import { todayISO } from '../domain/dates'
import type { SyncEngine, SyncStatus } from './contracts'
import { NoSpace, Offline, Unauthorized, YandexError, type DiskClient, type ResourceStat } from './yandex/api'

/**
 * Синхронизация через Яндекс.Диск (спецификация, раздел 6.1).
 *
 * На Диске лежит один файл — полная копия базы вместе с пометками об удалении. Цикл:
 *   1) узнать версию файла (md5) и скачать его;
 *   2) слить со своей базой (domain/merge.ts) и записать себе то, чего не было;
 *   3) если на Диске не то же самое — сверить версию ещё раз и загрузить результат;
 *      версия сменилась (другое устройство успело записать) — начать заново, до 3 попыток;
 *   4) раз в день — копия garage.json в backups/, храним 30 последних (до вложений: сбой файла её не остановит);
 *   5) загрузить файлы вложений, удалить с Диска файлы удалённых вложений.
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
  /** Web Locks: цикл идёт под блокировкой, чтобы вкладки и окна PWA не синхронизировались одновременно. */
  locks?: SyncLocks | null
}

export interface SyncLocks {
  request(name: string, options: { signal?: AbortSignal }, callback: () => Promise<void>): Promise<unknown>
}

export const SYNC_LOCK = 'myauto-sync'
/**
 * Цикл, от Диска которого нет ответа дольше этого, считается зависшим (связь оборвалась без ошибки): статус —
 * «зависла», блокировка отпускается. Считаем тишину, а не всю длительность: длинная загрузка фото с ответами
 * Диска на каждый файл — не зависание. Столько же ждём блокировку, которую держит другая вкладка.
 */
export const SYNC_STALL_MS = 2 * 60 * 1000
const STALLED = 'Синхронизация зависла — попробуйте ещё раз'
/** Самая медленная связь, на которой загрузка ещё не «зависла»: 16 КБ/с ≈ 128 кбит/с. */
const SLOWEST_UPLOAD_BYTES_PER_S = 16_384

/** Сколько ждать ответа на запрос: загрузке большого файла — по его размеру на самой медленной связи. */
function silenceBudget(method: PropertyKey, args: unknown[]): number {
  const bytes =
    method === 'uploadBlob'
      ? (args[1] as Blob).size
      : method === 'writeText'
        ? (args[1] as string).length * 2 // garage.json: кириллица в UTF-8 — до двух байт на символ
        : 0
  return Math.max(SYNC_STALL_MS, (bytes / SLOWEST_UPLOAD_BYTES_PER_S) * 1000)
}

const browserLocks = (): SyncLocks | null =>
  typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null

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
    if (e instanceof SnapshotError && typeof version === 'number' && version > SCHEMA_VERSION)
      throw new SyncFailure(e.message)
    console.warn('Файл синхронизации не прошёл проверку', e)
    throw new SyncFailure(CORRUPTED)
  }
}

/**
 * Клиент Диска, который сообщает о каждом запросе (с бюджетом ожидания ответа) и ответе — по ним цикл понимает,
 * что не завис.
 */
function watchDisk(disk: DiskClient, onActivity: (budgetMs: number) => void): DiskClient {
  return new Proxy(disk, {
    get(target, prop, receiver) {
      const value: unknown = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value
      return (...args: unknown[]) => {
        onActivity(silenceBudget(prop, args))
        return Promise.resolve(value.apply(target, args)).finally(() => onActivity(SYNC_STALL_MS))
      }
    },
  })
}

/** Связь цикла со сторожем: активность Диска и статус, который брошенный цикл уже не пишет. */
interface CycleWatch {
  activity(budgetMs: number): void
  report(patch: Partial<SyncStatus>): void
}

/** Версия файла на Диске: md5, а если его нет — время изменения. null — файла нет. */
const revision = (stat: ResourceStat | null): string | null =>
  stat ? (stat.md5 ?? stat.modified ?? '') : null

export function createSyncEngine(deps: EngineDeps): SyncEngine {
  const { db } = deps
  const now = deps.now ?? (() => Date.now())
  const today = deps.today ?? (() => todayISO())
  const isOnline = deps.isOnline ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false)
  const debounceMs = deps.debounceMs ?? 2500
  const intervalMs = deps.intervalMs ?? 5 * 60 * 1000
  const locks = deps.locks === undefined ? browserLocks() : deps.locks

  let status: SyncStatus = { state: 'off', pendingUploads: 0 }
  const subscribers = new Set<(s: SyncStatus) => void>()
  let running: Promise<void> | null = null
  /** Номер последнего начатого цикла: статус пишет только он, брошенный сторожем — уже нет. */
  let latestCycle = 0
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
      const merged = await db.transaction(
        'rw',
        SYNC_TABLES.map((name) => db.table(name)),
        async () => {
          const local = await readSnapshot(db, now())
          const result = mergeSnapshots(local, remote)
          await applyRows(db, diffTables(local.tables, result.tables))
          return result
        },
      )

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
      if (e instanceof NoSpace) throw e // нехватку места человек должен увидеть
      console.warn('Резервная копия на Диске не сохранилась', e)
    }
  }

  async function refreshPending(report: CycleWatch['report']): Promise<void> {
    if (!deps.attachments) return
    try {
      const pendingUploads = await deps.attachments.pendingCount()
      if (pendingUploads !== status.pendingUploads) report({ pendingUploads })
    } catch (e) {
      console.warn('Не удалось посчитать неотправленные файлы', e)
    }
  }

  async function cycle({ activity, report }: CycleWatch): Promise<void> {
    const connected = deps.getDisk()
    const disk = connected && watchDisk(connected, activity)
    if (!disk) {
      report(authError ? { state: 'error', error: authError } : { state: 'off' })
      await refreshPending(report)
      return
    }
    authError = null
    if (!isOnline()) {
      report({ state: 'offline' })
      await refreshPending(report)
      return
    }
    report({ state: 'syncing' })
    try {
      await syncGarage(disk)
      // Копия дня — сразу после garage.json: постоянный сбой одного файла вложения не должен её останавливать.
      await dailyBackup(disk)
      if (deps.attachments) {
        await deps.attachments.uploadPending(disk)
        await deps.attachments.cleanupDeleted(disk)
      }
      const at = now()
      await setMeta(db, META_KEYS.lastSyncAt, at)
      const pendingUploads = deps.attachments ? await deps.attachments.pendingCount() : 0
      report({ state: 'idle', lastSyncAt: at, pendingUploads })
    } catch (e) {
      if (e instanceof Unauthorized) {
        authError = e.message
        try {
          await deps.onUnauthorized?.()
        } catch (err) {
          console.warn('Не удалось стереть токен', err)
        }
        report({ state: 'error', error: e.message })
      } else if (e instanceof Offline) {
        report({ state: 'offline' })
      } else if (e instanceof YandexError || e instanceof SyncFailure) {
        report({ state: 'error', error: e.message })
      } else {
        console.warn('Синхронизация не удалась', e)
        report({ state: 'error', error: 'Синхронизация не удалась — повторите позже' })
      }
      await refreshPending(report)
    }
  }

  /**
   * Цикл со сторожем: Диск молчит дольше бюджета (SYNC_STALL_MS, загрузке большого файла — больше) — статус
   * «зависла», и цикл считается законченным (блокировка отпускается, следующий syncNow начнёт заново). Сам
   * зависший запрос отменить нечем — если он всё же ответит, брошенный цикл доработает (слияние идемпотентно),
   * но сторожа больше не заводит, а статус пишет, только пока новый цикл не начался.
   */
  function guardedCycle(): Promise<void> {
    const id = ++latestCycle
    return new Promise<void>((resolve, reject) => {
      let settled = false
      let timer: ReturnType<typeof setTimeout> | undefined
      const activity = (budgetMs: number) => {
        if (settled) return
        clearTimeout(timer)
        timer = setTimeout(() => {
          settled = true
          console.warn('Синхронизация зависла: Диск не отвечает')
          setStatus({ state: 'error', error: STALLED })
          resolve()
        }, budgetMs)
      }
      const report = (patch: Partial<SyncStatus>) => {
        if (id === latestCycle) setStatus(patch)
      }
      activity(SYNC_STALL_MS)
      cycle({ activity, report })
        .then(resolve, reject)
        .finally(() => {
          settled = true
          clearTimeout(timer)
        })
    })
  }

  /**
   * Цикл под блокировкой Web Locks, если она есть: две вкладки или окна PWA не синхронизируются разом.
   * Упал сам цикл — ошибка уходит вызвавшему, второй раз без блокировки не запускаем. Блокировку не дали
   * (API нет или он сломан) — синхронизируемся без неё. Другая вкладка держит блокировку дольше SYNC_STALL_MS —
   * перестаём ждать без ошибки и статус не трогаем: база общая, её синхронизирует та вкладка (а зависнув, она
   * отпустит блокировку по своему сторожу); следующий цикл — по интервалу или событию.
   */
  function lockedCycle(): Promise<void> {
    if (!locks) return guardedCycle()
    let granted = false
    const wait = new AbortController()
    const waitTimer = setTimeout(() => wait.abort(), SYNC_STALL_MS)
    const run = () => {
      granted = true
      clearTimeout(waitTimer)
      return guardedCycle()
    }
    return Promise.resolve()
      .then(() => locks.request(SYNC_LOCK, { signal: wait.signal }, run))
      .then(
        () => undefined,
        (e: unknown) => {
          clearTimeout(waitTimer)
          if (granted) throw e
          if (wait.signal.aborted) {
            console.warn('Блокировку синхронизации держит другая вкладка — этот цикл пропускаем', e)
            return
          }
          console.warn('Блокировка синхронизации не получена — синхронизируемся без неё', e)
          return guardedCycle()
        },
      )
  }

  function syncNow(): Promise<void> {
    if (running) return running
    running = lockedCycle().finally(() => {
      running = null
    })
    return running
  }

  /** Запуск без ожидания (события, таймеры): упавший цикл — предупреждение, а не необработанная ошибка. */
  function syncInBackground(): void {
    syncNow().catch((e: unknown) => console.warn('Синхронизация не удалась', e))
  }

  /** Серия правок уходит одним файлом; правка во время идущего цикла — следующим циклом. */
  function scheduleAfterChange(): void {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      if (running) void running.then(syncInBackground, syncInBackground)
      else syncInBackground()
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
        if (document.visibilityState === 'visible') syncInBackground()
      }
      const onOnline = () => syncInBackground()
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('online', onOnline)
      const interval = setInterval(() => {
        if (document.visibilityState !== 'hidden') syncInBackground()
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
      syncInBackground()
    },

    stop() {
      for (const cleanup of cleanups) cleanup()
      cleanups = []
      started = false
    },
  }
}
