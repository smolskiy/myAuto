import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { MyAutoDB } from '../db/schema'
import { createRepos } from '../db/repos'
import { META_KEYS, getMeta } from '../db/meta'
import { FakeDisk } from './yandex/fakeDisk'
import {
  NoSpace,
  Offline,
  Unauthorized,
  YandexError,
  createDiskClient,
  type DiskClient,
  type ResourceStat,
} from './yandex/api'
import { GARAGE_PATH, SYNC_STALL_MS, createSyncEngine, type SyncLocks } from './engine'
import type { Snapshot } from '../domain/snapshot'

const dbs: MyAutoDB[] = []
const newDb = () => {
  const d = new MyAutoDB(`t-${crypto.randomUUID()}`)
  dbs.push(d)
  return d
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()))
  vi.useRealTimers()
})

const engineFor = (
  db: MyAutoDB,
  disk: FakeDisk | null,
  extra: Partial<Parameters<typeof createSyncEngine>[0]> = {},
) => createSyncEngine({ db, getDisk: () => disk, today: () => '2026-09-25', isOnline: () => true, ...extra })

describe('цикл синхронизации', () => {
  let disk: FakeDisk
  beforeEach(() => {
    disk = new FakeDisk()
  })

  test('первая синхронизация выгружает локальные данные', async () => {
    const db = newDb()
    await createRepos(db).places.create({ kind: 'service', name: 'СТО' })
    const engine = engineFor(db, disk)
    await engine.syncNow()
    expect(disk.peekJson<Snapshot>(GARAGE_PATH)!.tables.places.map((p) => p.name)).toEqual(['СТО'])
    expect(engine.getStatus()).toMatchObject({ state: 'idle', pendingUploads: 0 })
    expect(engine.getStatus().lastSyncAt).toBeTypeOf('number')
  })

  test('два устройства сходятся, удаление доходит', async () => {
    const a = newDb(),
      b = newDb()
    const ra = createRepos(a),
      rb = createRepos(b)
    const pa = await ra.places.create({ kind: 'service', name: 'A' })
    await rb.places.create({ kind: 'fuel', name: 'B' })
    const ea = engineFor(a, disk),
      eb = engineFor(b, disk)
    await ea.syncNow()
    await eb.syncNow()
    await ea.syncNow()
    const names = async (d: MyAutoDB) =>
      (await d.places.toArray())
        .filter((p) => !p.deleted)
        .map((p) => p.name)
        .sort()
    expect(await names(a)).toEqual(['A', 'B'])
    expect(await names(b)).toEqual(['A', 'B'])
    await ra.places.remove(pa.id)
    await ea.syncNow()
    await eb.syncNow()
    expect(await names(b)).toEqual(['B'])
  })

  test('гонка: файл изменился между чтением и записью — повтор, ничего не потеряно', async () => {
    const a = newDb(),
      b = newDb()
    await createRepos(b).places.create({ kind: 'fuel', name: 'B' })
    await engineFor(b, disk).syncNow()
    await createRepos(a).places.create({ kind: 'service', name: 'A' })
    // Пока устройство A сливает прочитанный файл, B успевает записать новую версию
    disk.afterRead = async () => {
      disk.afterRead = undefined
      await createRepos(b).places.create({ kind: 'wash', name: 'B2' })
      await engineFor(b, disk).syncNow()
    }
    await engineFor(a, disk).syncNow()
    const onDisk = disk
      .peekJson<Snapshot>(GARAGE_PATH)!
      .tables.places.map((p) => p.name)
      .sort()
    expect(onDisk).toEqual(['A', 'B', 'B2'])
  })

  test('без изменений файл не перезаписывается', async () => {
    const db = newDb()
    const engine = engineFor(db, disk)
    await createRepos(db).places.create({ kind: 'service', name: 'СТО' })
    await engine.syncNow()
    const writes = disk.calls.filter((c) => c.startsWith('writeText')).length
    await engine.syncNow()
    expect(disk.calls.filter((c) => c.startsWith('writeText')).length).toBe(writes)
  })

  test('401: статус с просьбой войти заново и вызов onUnauthorized', async () => {
    const onUnauthorized = vi.fn(async () => {})
    disk.failNext(new Unauthorized('Вход в Яндекс истёк — войдите заново', 401))
    const engine = engineFor(newDb(), disk, { onUnauthorized })
    await engine.syncNow()
    expect(engine.getStatus()).toMatchObject({
      state: 'error',
      error: 'Вход в Яндекс истёк — войдите заново',
    })
    expect(onUnauthorized).toHaveBeenCalled()
  })

  test('нет сети → offline, нет места → error', async () => {
    const db = newDb()
    disk.failNext(new Offline('Нет связи с Яндекс.Диском', 0))
    const engine = engineFor(db, disk)
    await engine.syncNow()
    expect(engine.getStatus().state).toBe('offline')
    await createRepos(db).places.create({ kind: 'service', name: 'x' })
    disk.failNext(new NoSpace('На Яндекс.Диске нет места', 507), { method: 'writeText' })
    await engine.syncNow()
    expect(engine.getStatus()).toMatchObject({ state: 'error', error: 'На Яндекс.Диске нет места' })
  })

  test('сбой сети на сервере загрузки → offline, а не ошибка', async () => {
    const API = 'https://cloud-api.yandex.net/v1/disk'
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith(`${API}/resources/upload`))
        return new Response(JSON.stringify({ href: 'https://uploader/x', method: 'PUT' }))
      if (url.startsWith(API)) return new Response('{}', { status: 404 })
      throw new TypeError('Load failed')
    })
    const realDisk = createDiskClient('tok', fetchImpl as unknown as typeof fetch)
    const engine = createSyncEngine({
      db: newDb(),
      getDisk: () => realDisk,
      today: () => '2026-09-25',
      isOnline: () => true,
    })
    await engine.syncNow()
    expect(engine.getStatus().state).toBe('offline')
  })

  test('без подключения — off, без сети — offline без запросов', async () => {
    expect(
      (
        await (async () => {
          const e = engineFor(newDb(), null)
          await e.syncNow()
          return e.getStatus()
        })()
      ).state,
    ).toBe('off')
    const e = engineFor(newDb(), disk, { isOnline: () => false })
    await e.syncNow()
    expect(e.getStatus().state).toBe('offline')
    expect(disk.calls).toEqual([])
  })

  test('параллельные вызовы — один цикл', async () => {
    const engine = engineFor(newDb(), disk)
    const first = engine.syncNow()
    expect(engine.syncNow()).toBe(first)
    await first
    expect(engine.syncNow()).not.toBe(first)
  })

  test('ежедневная копия и чистка старше 30', async () => {
    for (let i = 1; i <= 31; i++)
      await disk.writeText(`app:/backups/2026-08-${String(i).padStart(2, '0')}.json`, '{}')
    const db = newDb()
    await engineFor(db, disk).syncNow()
    const list = await disk.list('app:/backups')
    expect(list).toContain('2026-09-25.json')
    expect(list).toHaveLength(30)
    expect(list).not.toContain('2026-08-01.json')
    expect(await getMeta(db, META_KEYS.lastBackupDate, null)).toBe('2026-09-25')
  })

  test('постоянный сбой загрузки вложения не мешает ежедневной копии garage.json', async () => {
    const db = newDb()
    await createRepos(db).places.create({ kind: 'service', name: 'СТО' })
    const broken = new YandexError('Файл не принят Диском', 400)
    const attachments = {
      uploadPending: vi.fn(async () => {
        throw broken
      }),
      cleanupDeleted: vi.fn(async () => {}),
      pendingCount: vi.fn(async () => 1),
    }
    const engine = engineFor(db, disk, { attachments })
    await engine.syncNow()
    expect(engine.getStatus()).toMatchObject({ state: 'error', error: 'Файл не принят Диском' })
    expect(await disk.list('app:/backups')).toEqual(['2026-09-25.json'])
    expect(disk.peekJson<Snapshot>('app:/backups/2026-09-25.json')!.tables.places.map((p) => p.name)).toEqual(
      ['СТО'],
    )
    expect(await getMeta(db, META_KEYS.lastBackupDate, null)).toBe('2026-09-25')
  })

  test('нет места при ежедневной копии — ошибка в статусе, а не тишина', async () => {
    disk.failNext(new NoSpace('На Яндекс.Диске нет места', 507), { method: 'copy' })
    const db = newDb()
    const engine = engineFor(db, disk)
    await engine.syncNow()
    expect(engine.getStatus()).toMatchObject({ state: 'error', error: 'На Яндекс.Диске нет места' })
    expect(await getMeta(db, META_KEYS.lastBackupDate, null)).toBeNull()
  })

  test('цикл идёт под общей блокировкой myauto-sync (вкладки и окна PWA не пересекаются)', async () => {
    const inside: boolean[] = []
    const locks = {
      request: vi.fn(async (_name: string, _options: LockOptions, cb: () => Promise<void>) => {
        const before = disk.calls.length
        await cb()
        inside.push(disk.calls.length > before)
      }),
    }
    await engineFor(newDb(), disk, { locks }).syncNow()
    expect(locks.request).toHaveBeenCalledWith(
      'myauto-sync',
      { signal: expect.any(AbortSignal) },
      expect.any(Function),
    )
    expect(inside).toEqual([true])
  })

  test('локальная правка запускает синхронизацию через 2,5 с', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const db = newDb()
    const engine = engineFor(db, disk)
    engine.start() // сразу запускает синхронизацию «при открытии»
    await engine.syncNow()
    disk.calls.length = 0
    await createRepos(db).places.create({ kind: 'service', name: 'СТО' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(disk.calls).toEqual([])
    await vi.advanceTimersByTimeAsync(1600)
    await vi.waitFor(() => expect(disk.peekJson<Snapshot>(GARAGE_PATH)!.tables.places).toHaveLength(1))
    engine.stop()
  })

  test('повреждённый файл на Диске — ошибка, файл не перезаписывается', async () => {
    await disk.writeText(GARAGE_PATH, 'не json')
    const db = newDb()
    await createRepos(db).places.create({ kind: 'service', name: 'СТО' })
    disk.calls.length = 0
    const engine = engineFor(db, disk)
    await engine.syncNow()
    expect(engine.getStatus()).toMatchObject({
      state: 'error',
      error: 'Файл синхронизации на Диске повреждён',
    })
    expect(disk.calls.filter((c) => c.startsWith('writeText') || c.startsWith('copy'))).toEqual([])
  })

  test('после 401 и стёртого токена статус по-прежнему просит войти заново', async () => {
    let current: FakeDisk | null = disk
    disk.failNext(new Unauthorized('Вход в Яндекс истёк — войдите заново', 401))
    const engine = engineFor(newDb(), null, {
      getDisk: () => current,
      onUnauthorized: async () => {
        current = null
      },
    })
    await engine.syncNow()
    await engine.syncNow()
    expect(engine.getStatus()).toMatchObject({
      state: 'error',
      error: 'Вход в Яндекс истёк — войдите заново',
    })
    current = disk
    await engine.syncNow()
    expect(engine.getStatus().state).toBe('idle')
  })

  test('без сети счётчик ждущих файлов всё равно обновляется', async () => {
    const attachments = {
      uploadPending: vi.fn(async () => {}),
      cleanupDeleted: vi.fn(async () => {}),
      pendingCount: vi.fn(async () => 2),
    }
    const engine = engineFor(newDb(), disk, { isOnline: () => false, attachments })
    await engine.syncNow()
    expect(engine.getStatus()).toMatchObject({ state: 'offline', pendingUploads: 2 })
    expect(attachments.uploadPending).not.toHaveBeenCalled()
  })

  test('правка во время идущего цикла уходит следующим циклом', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const db = newDb()
    let editDuringUpload = true
    const attachments = {
      // долгая загрузка фото: пользователь успевает сохранить запись, срабатывает таймер правки
      uploadPending: async () => {
        if (!editDuringUpload) return
        editDuringUpload = false
        await createRepos(db).places.create({ kind: 'service', name: 'Во время цикла' })
        await vi.advanceTimersByTimeAsync(2600)
      },
      cleanupDeleted: async () => {},
      pendingCount: async () => 0,
    }
    const engine = engineFor(db, disk, { attachments })
    engine.start()
    await vi.waitFor(() => expect(disk.peekJson<Snapshot>(GARAGE_PATH)?.tables.places).toHaveLength(1))
    engine.stop()
  })
})

/**
 * navigator.locks в миниатюре: одна блокировка на имя, очередь ожидающих, отмена ожидания по `signal`.
 * `holdForever()` — блокировку держит другая вкладка, чей цикл завис.
 */
class FakeLocks implements SyncLocks {
  held = false
  requests = 0
  private queue: (() => void)[] = []

  holdForever(): void {
    this.held = true
  }

  // Как у настоящего API: `request(name, callback)` и `request(name, options, callback)`.
  async request(
    _name: string,
    optionsOrCb: { signal?: AbortSignal } | (() => Promise<void>),
    maybeCb?: () => Promise<void>,
  ): Promise<unknown> {
    const options = typeof optionsOrCb === 'function' ? {} : optionsOrCb
    const cb = typeof optionsOrCb === 'function' ? optionsOrCb : maybeCb!
    this.requests += 1
    if (this.held) {
      await new Promise<void>((resolve, reject) => {
        const signal = options.signal
        const grant = () => {
          signal?.removeEventListener('abort', onAbort)
          resolve()
        }
        const onAbort = () => {
          this.queue = this.queue.filter((g) => g !== grant)
          reject(signal!.reason)
        }
        if (signal?.aborted) return reject(signal.reason)
        signal?.addEventListener('abort', onAbort)
        this.queue.push(grant)
      })
    }
    this.held = true
    try {
      return await cb()
    } finally {
      const next = this.queue.shift()
      if (next) next()
      else this.held = false
    }
  }
}

const STALLED = 'Синхронизация зависла — попробуйте ещё раз'

/** Поддельные часы — вперёд шагами, пока не выполнится условие: между шагами успевает отработать IndexedDB. */
async function advanceUntil(done: () => boolean, stepMs: number, maxSteps = 2000): Promise<void> {
  for (let i = 0; i < maxSteps && !done(); i++) await vi.advanceTimersByTimeAsync(stepMs)
}

describe('Web Locks и зависание цикла', () => {
  let disk: FakeDisk
  beforeEach(() => {
    disk = new FakeDisk()
  })

  test('цикл упал под блокировкой — без блокировки второй раз не запускается', async () => {
    const getDisk = vi.fn((): FakeDisk | null => {
      throw new Error('токен не читается')
    })
    const locks = new FakeLocks()
    const engine = engineFor(newDb(), null, { getDisk, locks })
    await expect(engine.syncNow()).rejects.toThrow('токен не читается')
    expect(getDisk).toHaveBeenCalledTimes(1)
    expect(locks.held).toBe(false)
  })

  test('блокировку не дали (API бросает) — цикл идёт без неё', async () => {
    const locks: SyncLocks = {
      request: () => {
        throw new TypeError('locks.request is not supported')
      },
    }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const db = newDb()
    await createRepos(db).places.create({ kind: 'service', name: 'СТО' })
    const engine = engineFor(db, disk, { locks })
    await engine.syncNow()
    expect(engine.getStatus().state).toBe('idle')
    expect(disk.peekJson<Snapshot>(GARAGE_PATH)!.tables.places).toHaveLength(1)
  })

  test('блокировку 2 мин держит другая вкладка — ожидание снимается, статус прежний, без неё цикл не идёт', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const locks = new FakeLocks()
    const db = newDb()
    const engine = engineFor(db, disk, { locks })
    await engine.syncNow()
    const before = engine.getStatus()
    expect(before.state).toBe('idle')
    disk.calls.length = 0
    locks.holdForever() // другая вкладка синхронизируется долго (или зависла)
    let done = false
    const run = engine.syncNow().then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(SYNC_STALL_MS - 1000)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(2000)
    await run
    // Ошибки нет: синхронизирует другая вкладка (база общая); повторит интервал.
    expect(engine.getStatus()).toEqual(before)
    expect(disk.calls).toEqual([])
    expect(engine.syncNow()).not.toBe(run) // ожидание снято — следующий вызов просит блокировку заново
    await vi.advanceTimersByTimeAsync(SYNC_STALL_MS + 1000)
    expect(locks.requests).toBe(3)
  })

  test('Диск не отвечает — через 2 мин «зависла», блокировка отпущена, повтор проходит', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let asked = false
    const hanging = Object.assign(Object.create(disk) as FakeDisk, {
      // обрыв без ошибки: ответ не придёт никогда
      stat: () => {
        asked = true
        return new Promise<never>(() => {})
      },
    })
    let current: FakeDisk = hanging
    const locks = new FakeLocks()
    const engine = engineFor(newDb(), null, { getDisk: () => current, locks })
    let done = false
    const run = engine.syncNow().then(() => {
      done = true
    })
    await advanceUntil(() => asked, 10)
    await vi.advanceTimersByTimeAsync(SYNC_STALL_MS - 1000)
    expect(done).toBe(false)
    expect(engine.getStatus().state).toBe('syncing')
    await vi.advanceTimersByTimeAsync(2000)
    await run
    expect(engine.getStatus()).toMatchObject({ state: 'error', error: STALLED })
    expect(locks.held).toBe(false)

    current = disk
    await engine.syncNow()
    expect(engine.getStatus().state).toBe('idle')
  })

  test('долгая загрузка фото с ответами Диска зависанием не считается', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const attachments = {
      // 5 файлов по 50 с: всего дольше 2 мин, но Диск отвечает на каждый
      uploadPending: async (d: DiskClient) => {
        for (let i = 0; i < 5; i++) {
          await new Promise((r) => setTimeout(r, 50_000))
          await d.uploadBlob(`app:/attachments/${i}.jpg`, new Blob(['x']), 'image/jpeg')
        }
      },
      cleanupDeleted: async () => {},
      pendingCount: async () => 0,
    }
    const engine = engineFor(newDb(), disk, { attachments, locks: new FakeLocks() })
    let done = false
    const run = engine.syncNow().then(() => {
      done = true
    })
    await advanceUntil(() => done, 500)
    await run
    expect(disk.calls.filter((c) => c.startsWith('uploadBlob'))).toHaveLength(5)
    expect(engine.getStatus().state).toBe('idle')
  })
})

describe('сторож зависания: бюджет загрузки и брошенный цикл', () => {
  let disk: FakeDisk
  beforeEach(() => {
    disk = new FakeDisk()
  })

  test('большой файл грузится 3 мин — не «зависла», цикл доходит до конца', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const slow = Object.assign(Object.create(disk) as FakeDisk, {
      // 20 МБ на медленной связи: ответ только через 3 мин
      uploadBlob: () => new Promise<void>((r) => setTimeout(r, 3 * 60_000)),
    })
    const pdf = { size: 20 * 1024 * 1024 } as Blob
    const attachments = {
      uploadPending: (d: DiskClient) => d.uploadBlob('app:/attachments/scan.pdf', pdf, 'application/pdf'),
      cleanupDeleted: async () => {},
      pendingCount: async () => 0,
    }
    const engine = engineFor(newDb(), slow, { attachments, locks: new FakeLocks() })
    let done = false
    const run = engine.syncNow().then(() => {
      done = true
    })
    await advanceUntil(() => done, 1000, 400)
    await run
    expect(engine.getStatus().state).toBe('idle')
  })

  test('поздний ответ брошенного цикла не перезаводит сторожа и не портит статус следующего', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let answerStat: (s: ResourceStat | null) => void = () => {}
    let asked = false
    const flaky = Object.assign(Object.create(disk) as FakeDisk, {
      stat: () => {
        asked = true
        return new Promise<ResourceStat | null>((r) => (answerStat = r))
      },
      readText: () => new Promise<never>(() => {}), // после позднего ответа снова тишина
    })
    let current: FakeDisk = flaky
    const engine = engineFor(newDb(), null, { getDisk: () => current, locks: new FakeLocks() })
    const first = engine.syncNow()
    await advanceUntil(() => asked, 10)
    await vi.advanceTimersByTimeAsync(SYNC_STALL_MS + 1000)
    await first
    expect(engine.getStatus()).toMatchObject({ state: 'error', error: STALLED })

    current = disk
    await engine.syncNow()
    expect(engine.getStatus().state).toBe('idle')

    answerStat({ md5: 'x', modified: 'x' }) // брошенный цикл оживает и снова замолкает на readText
    await vi.advanceTimersByTimeAsync(SYNC_STALL_MS + 1000)
    expect(engine.getStatus().state).toBe('idle')
    expect(warn.mock.calls.filter(([m]) => String(m).includes('зависла'))).toHaveLength(1)
  })

  test('брошенный цикл, дойдя до конца, не переписывает статус идущего нового', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const answers: ((s: ResourceStat | null) => void)[] = []
    const flaky = Object.assign(Object.create(disk) as FakeDisk, {
      // первые два запроса (старый и новый цикл) ждут ответа вручную, дальше Диск отвечает сам
      stat: (path: string) =>
        answers.length < 2 ? new Promise<ResourceStat | null>((r) => answers.push(r)) : disk.stat(path),
    })
    const db = newDb()
    const engine = engineFor(db, flaky, { locks: new FakeLocks() })
    const first = engine.syncNow()
    await advanceUntil(() => answers.length === 1, 10)
    await vi.advanceTimersByTimeAsync(SYNC_STALL_MS + 1000)
    await first
    void engine.syncNow() // новый цикл ждёт свой stat
    await advanceUntil(() => answers.length === 2, 10)
    expect(engine.getStatus().state).toBe('syncing')

    answers[0]!(null) // брошенный цикл получает ответ и доходит до конца (записывает время синхронизации)
    for (let i = 0; i < 500 && (await getMeta(db, META_KEYS.lastSyncAt, null)) === null; i++)
      await vi.advanceTimersByTimeAsync(10)
    expect(await getMeta(db, META_KEYS.lastSyncAt, null)).not.toBeNull()
    await vi.advanceTimersByTimeAsync(100)
    expect(engine.getStatus().state).toBe('syncing')
  })

  test('фоновый запуск: упавший цикл — предупреждение, а не необработанная ошибка', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const engine = engineFor(newDb(), null, {
      getDisk: () => {
        throw new Error('токен не читается')
      },
      locks: null,
    })
    engine.start()
    await vi.waitFor(() =>
      expect(warn.mock.calls.some((args) => args.some((a) => String(a).includes('токен не читается')))).toBe(
        true,
      ),
    )
    engine.stop()
  })
})
