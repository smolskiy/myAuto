import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { MyAutoDB } from '../db/schema'
import { createRepos } from '../db/repos'
import { META_KEYS, getMeta } from '../db/meta'
import { FakeDisk } from './yandex/fakeDisk'
import { NoSpace, Offline, Unauthorized } from './yandex/api'
import { GARAGE_PATH, createSyncEngine } from './engine'
import type { Snapshot } from '../domain/snapshot'

const dbs: MyAutoDB[] = []
const newDb = () => { const d = new MyAutoDB(`t-${crypto.randomUUID()}`); dbs.push(d); return d }
afterEach(async () => { await Promise.all(dbs.splice(0).map((d) => d.delete())); vi.useRealTimers() })

const engineFor = (db: MyAutoDB, disk: FakeDisk | null, extra: Partial<Parameters<typeof createSyncEngine>[0]> = {}) =>
  createSyncEngine({ db, getDisk: () => disk, today: () => '2026-09-25', isOnline: () => true, ...extra })

describe('цикл синхронизации', () => {
  let disk: FakeDisk
  beforeEach(() => { disk = new FakeDisk() })

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
    const a = newDb(), b = newDb()
    const ra = createRepos(a), rb = createRepos(b)
    const pa = await ra.places.create({ kind: 'service', name: 'A' })
    await rb.places.create({ kind: 'fuel', name: 'B' })
    const ea = engineFor(a, disk), eb = engineFor(b, disk)
    await ea.syncNow(); await eb.syncNow(); await ea.syncNow()
    const names = async (d: MyAutoDB) => (await d.places.toArray()).filter((p) => !p.deleted).map((p) => p.name).sort()
    expect(await names(a)).toEqual(['A', 'B'])
    expect(await names(b)).toEqual(['A', 'B'])
    await ra.places.remove(pa.id)
    await ea.syncNow(); await eb.syncNow()
    expect(await names(b)).toEqual(['B'])
  })

  test('гонка: файл изменился между чтением и записью — повтор, ничего не потеряно', async () => {
    const a = newDb(), b = newDb()
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
    const onDisk = disk.peekJson<Snapshot>(GARAGE_PATH)!.tables.places.map((p) => p.name).sort()
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
    expect(engine.getStatus()).toMatchObject({ state: 'error', error: 'Вход в Яндекс истёк — войдите заново' })
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

  test('без подключения — off, без сети — offline без запросов', async () => {
    expect((await (async () => { const e = engineFor(newDb(), null); await e.syncNow(); return e.getStatus() })()).state).toBe('off')
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
    for (let i = 1; i <= 31; i++) await disk.writeText(`app:/backups/2026-08-${String(i).padStart(2, '0')}.json`, '{}')
    const db = newDb()
    await engineFor(db, disk).syncNow()
    const list = await disk.list('app:/backups')
    expect(list).toContain('2026-09-25.json')
    expect(list).toHaveLength(30)
    expect(list).not.toContain('2026-08-01.json')
    expect(await getMeta(db, META_KEYS.lastBackupDate, null)).toBe('2026-09-25')
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
    expect(engine.getStatus()).toMatchObject({ state: 'error', error: 'Файл синхронизации на Диске повреждён' })
    expect(disk.calls.filter((c) => c.startsWith('writeText') || c.startsWith('copy'))).toEqual([])
  })

  test('после 401 и стёртого токена статус по-прежнему просит войти заново', async () => {
    let current: FakeDisk | null = disk
    disk.failNext(new Unauthorized('Вход в Яндекс истёк — войдите заново', 401))
    const engine = engineFor(newDb(), null, { getDisk: () => current, onUnauthorized: async () => { current = null } })
    await engine.syncNow()
    await engine.syncNow()
    expect(engine.getStatus()).toMatchObject({ state: 'error', error: 'Вход в Яндекс истёк — войдите заново' })
    current = disk
    await engine.syncNow()
    expect(engine.getStatus().state).toBe('idle')
  })

  test('без сети счётчик ждущих файлов всё равно обновляется', async () => {
    const attachments = { uploadPending: vi.fn(async () => {}), cleanupDeleted: vi.fn(async () => {}), pendingCount: vi.fn(async () => 2) }
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
