# Волна 1 · sync-storage — Яндекс.Диск, вход, синхронизация, вложения, бэкапы: план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Слой `src/sync/**`, реализующий замороженные интерфейсы `SyncEngine`, `YandexAuth`, `AttachmentStore`,
`BackupService` из `src/sync/contracts.ts`: клиент REST API Яндекс.Диска, вход (implicit flow + код), цикл
синхронизации с защитой от гонки, фото с сжатием и очередью загрузки, ежедневные бэкапы, выгрузка/загрузка JSON и Excel.
Всё проверено тестами на фейковом Диске в памяти.

**Architecture:** Каждая служба — фабрика с внедряемыми зависимостями (`db`, `getDisk`, `now`, таймеры, `fetch`),
чтобы тесты шли на `fake-indexeddb` + `FakeDisk`; `src/sync/index.ts` собирает боевые синглтоны.
Подход и значительная часть кода — из `F:\projects\stats\src\lib\yandex.ts` и `sync.ts` (проверено в работе).

**Tech Stack:** TypeScript 6, Dexie 4.4, Vitest 5 + fake-indexeddb, SheetJS (`xlsx`, ленивый импорт), Canvas API.

**Spec:** `docs/superpowers/specs/2026-09-25-myauto-design.md` (раздел 6)

**Зона агента:** `src/sync/**` (кроме `contracts.ts` — заморожен), `public/oauth.html`. Не трогать `src/domain`, `src/db`,
`src/ui`, `src/features`, `src/app`. Новых npm-зависимостей не добавлять (`xlsx` уже стоит).

**Опирается на волну 0:** `parseSnapshot`, `emptySnapshot`, `TABLE_NAMES`, `SnapshotTables` (`domain/snapshot.ts`);
`mergeSnapshots`, `sameSnapshot`, `diffTables` (`domain/merge.ts`); `todayISO`, `addDays` (`domain/dates.ts`); `newId`;
`MyAutoDB`, `BlobRow` (`db/schema.ts`); `db` (`db/instance.ts`); `createRepos` (`db/repos.ts`); `readSnapshot`, `applyRows`,
`replaceAll` (`db/snapshotIO.ts`); `META_KEYS`, `getMeta`, `setMeta`, `deleteMeta` (`db/meta.ts`);
`subscribeLocalChanges`, `emitLocalChange` (`db/changes.ts`).

## Global Constraints

- Все сообщения об ошибках — по-русски, для человека, без кодов в начале; техническая деталь — в `console.warn`.
- Токен Яндекса хранится только в `meta` (`META_KEYS.yandexToken`), в URL и логи не попадает.
- Приложение видит только папку приложения (`app:/`). Пути: `app:/garage.json`, `app:/attachments/<id>.jpg|.pdf`,
  `app:/attachments/<id>.thumb.jpg`, `app:/backups/YYYY-MM-DD.json`.
- Синхронизация никогда не блокирует работу с данными и не бросает исключений наружу из `syncNow` — только статус.
- Одновременно идёт не больше одного цикла.
- Перед отчётом: `npm run typecheck && npm run lint && npm test` зелёные.

## Review Focus

1. **Два устройства правят одновременно** — файл на Диске изменился между скачиванием и загрузкой; ничья правка не теряется.
   Тест — Task 4.
2. **Токен истёк посреди цикла (401)** — статус «войдите заново», токен стёрт, данные на месте, повторных попыток нет. Тест — Task 4.
3. **Фото снято без интернета** — остаётся на устройстве с `pending`, уходит на Диск при следующем цикле, счётчик
   «ждут загрузки» корректен; оригинал до загрузки никогда не вытесняется из кеша. Тест — Task 5.
4. **Импорт старого бэкапа поверх свежих данных в режиме «Объединить»** — более новые локальные правки не затираются. Тест — Task 6.
5. **Повторный заход на `oauth.html` с чужим `state`** (подделка/старая вкладка) — токен не принимается. Тест — Task 3.

---

### Task 1: Клиент REST API Яндекс.Диска

**Files:**
- Create: `src/sync/yandex/api.ts`, `src/sync/yandex/api.test.ts`

**Interfaces:**
- Produces:
  - `class YandexError extends Error { status: number }`, `class Unauthorized extends YandexError`,
    `class NoSpace extends YandexError`, `class Offline extends YandexError`
  - `interface ResourceStat { md5?: string; size?: number; modified?: string }`
  - `interface DiskClient {
      checkAccess(): Promise<void>
      stat(path: string): Promise<ResourceStat | null>
      readText(path: string): Promise<string | null>
      downloadBlob(path: string): Promise<Blob | null>
      writeText(path: string, text: string, contentType?: string): Promise<void>
      uploadBlob(path: string, blob: Blob, contentType: string): Promise<void>
      ensureFolder(path: string): Promise<void>
      copy(from: string, to: string): Promise<void>
      remove(path: string): Promise<void>            // 404 — не ошибка
      list(dir: string): Promise<string[]>           // имена файлов; нет папки → []
    }`
  - `createDiskClient(token: string, fetchImpl?: typeof fetch): DiskClient`

- [ ] **Step 1: Падающий тест** — `src/sync/yandex/api.test.ts`:

```ts
import { describe, expect, test, vi } from 'vitest'
import { NoSpace, Offline, Unauthorized, createDiskClient } from './api'

const API = 'https://cloud-api.yandex.net/v1/disk'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('клиент Диска', () => {
  test('авторизация заголовком OAuth и чтение файла через ссылку', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.startsWith(API) ? json({ href: 'https://downloader.disk.yandex.ru/x' }) : new Response('{"a":1}'))
    const disk = createDiskClient('tok', fetchImpl as unknown as typeof fetch)
    await expect(disk.readText('app:/garage.json')).resolves.toBe('{"a":1}')
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(`${API}/resources/download?path=${encodeURIComponent('app:/garage.json')}`)
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'OAuth tok' })
  })

  test('нет файла → null', async () => {
    const disk = createDiskClient('tok', vi.fn(async () => json({ error: 'DiskNotFoundError' }, 404)) as unknown as typeof fetch)
    await expect(disk.readText('app:/garage.json')).resolves.toBeNull()
    await expect(disk.stat('app:/garage.json')).resolves.toBeNull()
  })

  test('stat отдаёт md5', async () => {
    const disk = createDiskClient('tok', vi.fn(async () => json({ md5: 'abc', size: 10, modified: '2026-09-25T10:00:00+00:00' })) as unknown as typeof fetch)
    await expect(disk.stat('app:/garage.json')).resolves.toEqual({ md5: 'abc', size: 10, modified: '2026-09-25T10:00:00+00:00' })
  })

  test('загрузка: получить адрес, затем PUT', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) =>
      url.startsWith(API) ? json({ href: 'https://uploader/x', method: 'PUT' }) : new Response(null, { status: init?.method === 'PUT' ? 201 : 500 }))
    await createDiskClient('tok', fetchImpl as unknown as typeof fetch).writeText('app:/garage.json', '{}')
    expect(fetchImpl.mock.calls[0]![0]).toBe(`${API}/resources/upload?path=${encodeURIComponent('app:/garage.json')}&overwrite=true`)
    expect(fetchImpl.mock.calls[1]![1]).toMatchObject({ method: 'PUT', body: '{}' })
  })

  test.each([
    [401, Unauthorized, 'Вход в Яндекс истёк — войдите заново'],
    [507, NoSpace, 'На Яндекс.Диске нет места'],
  ])('код %i → %s', async (status, Cls, message) => {
    const disk = createDiskClient('tok', vi.fn(async () => json({}, status)) as unknown as typeof fetch)
    const err = await disk.stat('app:/x').catch((e) => e)
    expect(err).toBeInstanceOf(Cls)
    expect(err.message).toBe(message)
  })

  test('сетевой сбой → Offline', async () => {
    const disk = createDiskClient('tok', vi.fn(async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch)
    await expect(disk.stat('app:/x')).rejects.toBeInstanceOf(Offline)
  })

  test('удаление: 404 — не ошибка; список папки', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') return json({}, 404)
      return json({ _embedded: { items: [{ name: '2026-09-24.json', type: 'file' }, { name: 'sub', type: 'dir' }] } })
    })
    const disk = createDiskClient('tok', fetchImpl as unknown as typeof fetch)
    await expect(disk.remove('app:/attachments/x.jpg')).resolves.toBeUndefined()
    await expect(disk.list('app:/backups')).resolves.toEqual(['2026-09-24.json'])
  })
})
```

- [ ] **Step 2: Запустить — падает** (`npx vitest run src/sync/yandex/api.test.ts`)

- [ ] **Step 3: Реализация** — перенести `api`, `fail`, `download` (с повтором «чистым» запросом для Safari), `write`,
  `ensureFolder` (409 — ок), `copy` из `F:\projects\stats\src\lib\yandex.ts`; добавить `stat`
  (`GET /resources?path=…&fields=md5,size,modified`), `downloadBlob`, `uploadBlob`, `remove`
  (`DELETE /resources?path=…&permanently=true`, 202/204/404 — ок), `list` (`GET /resources?path=…&limit=1000&fields=_embedded.items.name,_embedded.items.type`,
  404 → `[]`). Сетевые исключения → `Offline('Нет связи с Яндекс.Диском', 0)`. `checkAccess` — как в `stats`
  (запрос к `app:/`, 404 — ок, 403 — понятный текст про доступ к папке приложения).

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit** — `git commit -m "feat(sync): Yandex Disk REST client"`

---

### Task 2: Фейковый Диск для тестов

**Files:**
- Create: `src/sync/yandex/fakeDisk.ts`, `src/sync/yandex/fakeDisk.test.ts`

**Interfaces:**
- Produces: `class FakeDisk implements DiskClient` с дополнительно:
  `files: Map<string, { data: string | Blob; md5: string }>`, `calls: string[]` (имя метода + путь),
  `failNext(error: Error, opts?: { method?: keyof DiskClient; times?: number }): void` (без `method` — любой следующий вызов),
  `afterRead?: (path: string) => void | Promise<void>` (крючок для гонок: вызывается после `readText`, до возврата результата),
  `peekJson<T>(path: string): T | undefined`. `md5` — любой детерминированный хеш содержимого (например, длина + простая
  сумма кодов) — меняется при изменении содержимого.

- [ ] **Step 1: Падающий тест**

```ts
import { expect, test } from 'vitest'
import { FakeDisk } from './fakeDisk'
import { Offline } from './api'

test('фейковый Диск ведёт себя как настоящий', async () => {
  const disk = new FakeDisk()
  expect(await disk.readText('app:/garage.json')).toBeNull()
  await disk.writeText('app:/garage.json', '{"a":1}')
  const s1 = await disk.stat('app:/garage.json')
  await disk.writeText('app:/garage.json', '{"a":2}')
  expect((await disk.stat('app:/garage.json'))!.md5).not.toBe(s1!.md5)
  await disk.copy('app:/garage.json', 'app:/backups/2026-09-25.json')
  expect(await disk.list('app:/backups')).toEqual(['2026-09-25.json'])
  disk.failNext(new Offline('Нет связи с Яндекс.Диском', 0))
  await expect(disk.readText('app:/garage.json')).rejects.toBeInstanceOf(Offline)
  expect(await disk.readText('app:/garage.json')).toBe('{"a":2}')
})
```

- [ ] **Step 2–4: Реализовать до PASS.** **Step 5: Commit** — `git commit -m "test(sync): in-memory fake Yandex Disk"`

---

### Task 3: Вход в Яндекс и `oauth.html`

**Files:**
- Create: `src/sync/yandex/oauth.ts`, `src/sync/yandex/oauth.test.ts`, `public/oauth.html`

**Interfaces:**
- Consumes: `DiskClient`, `createDiskClient` (Task 1); `META_KEYS`, `getMeta`, `setMeta`, `deleteMeta`.
- Produces:
  - `extractToken(text: string): string` — из вставленного текста (голый токен, адрес с `#access_token=…`, с пробелами)
  - `createYandexAuth(deps: { db: MyAutoDB; location: Pick<Location, 'href'>; storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
      makeDisk?: (token: string) => DiskClient; envClientId?: string; onConnected?: () => void }): YandexAuth & {
      init(): Promise<void>                // читает токен и ClientID из meta в память
      getToken(): string | null
      consumeRedirect(): Promise<boolean>  // забирает токен, оставленный oauth.html
    }`
  - Константы: `OAUTH_STATE_KEY = 'myauto.oauth.state'`, `OAUTH_TOKEN_KEY = 'myauto.oauth.token'`,
    `VERIFICATION_URI = 'https://oauth.yandex.ru/verification_code'`

- [ ] **Step 1: Падающий тест** — `src/sync/yandex/oauth.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { MyAutoDB } from '../../db/schema'
import { META_KEYS, getMeta } from '../../db/meta'
import { FakeDisk } from './fakeDisk'
import { OAUTH_STATE_KEY, OAUTH_TOKEN_KEY, createYandexAuth, extractToken } from './oauth'
import { YandexError } from './api'

let db: MyAutoDB
const store = new Map<string, string>()
const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) }
const location = { href: 'https://smolskiy.github.io/myAuto/#/settings/sync' }
beforeEach(() => { db = new MyAutoDB(`t-${crypto.randomUUID()}`); store.clear() })
afterEach(async () => { await db.delete() })

test.each([
  ['y0_AgAAAAB  ', 'y0_AgAAAAB'],
  ['https://oauth.yandex.ru/verification_code#access_token=y0_XYZ&token_type=bearer&expires_in=31536000', 'y0_XYZ'],
  ['y0_ab\ncd', 'y0_abcd'],
])('токен из текста %j', (input, token) => expect(extractToken(input)).toBe(token))

describe('вход', () => {
  test('адрес implicit flow с возвратом на oauth.html и state', async () => {
    const auth = createYandexAuth({ db, location, storage, envClientId: 'cid' })
    await auth.init()
    const url = new URL(auth.loginUrl())
    expect(url.origin + url.pathname).toBe('https://oauth.yandex.ru/authorize')
    expect(url.searchParams.get('response_type')).toBe('token')
    expect(url.searchParams.get('client_id')).toBe('cid')
    expect(url.searchParams.get('redirect_uri')).toBe('https://smolskiy.github.io/myAuto/oauth.html')
    expect(url.searchParams.get('state')).toBe(store.get(OAUTH_STATE_KEY))
    expect(new URL(auth.verificationCodeUrl()).searchParams.get('redirect_uri')).toBe('https://oauth.yandex.ru/verification_code')
  })

  test('ClientID вручную, если его нет в сборке', async () => {
    const auth = createYandexAuth({ db, location, storage })
    await auth.init()
    expect(auth.getClientId()).toBeNull()
    auth.setClientId('manual')
    expect(new URL(auth.loginUrl()).searchParams.get('client_id')).toBe('manual')
    await vi.waitFor(async () => expect(await getMeta(db, META_KEYS.yandexClientId, null)).toBe('manual'))
  })

  test('подключение проверяет доступ и сохраняет токен', async () => {
    const onConnected = vi.fn()
    const auth = createYandexAuth({ db, location, storage, envClientId: 'cid', makeDisk: () => new FakeDisk(), onConnected })
    await auth.connectWithCode('  y0_TOKEN ')
    expect(auth.isConnected()).toBe(true)
    expect(await getMeta(db, META_KEYS.yandexToken, null)).toBe('y0_TOKEN')
    expect(onConnected).toHaveBeenCalled()
  })

  test('отказ Яндекса — токен не сохраняется', async () => {
    const disk = new FakeDisk()
    disk.failNext(new YandexError('Яндекс не дал доступ к Диску', 403))
    const auth = createYandexAuth({ db, location, storage, envClientId: 'cid', makeDisk: () => disk })
    await expect(auth.connectWithToken('bad')).rejects.toThrow('Яндекс не дал доступ к Диску')
    expect(auth.isConnected()).toBe(false)
    expect(await getMeta(db, META_KEYS.yandexToken, null)).toBeNull()
  })

  test('токен от oauth.html принимается только с совпавшим state', async () => {
    const auth = createYandexAuth({ db, location, storage, envClientId: 'cid', makeDisk: () => new FakeDisk() })
    auth.loginUrl()
    const state = store.get(OAUTH_STATE_KEY)!
    store.set(OAUTH_TOKEN_KEY, JSON.stringify({ token: 'y0_OK', state: 'forged' }))
    expect(await auth.consumeRedirect()).toBe(false)
    expect(auth.isConnected()).toBe(false)
    store.set(OAUTH_TOKEN_KEY, JSON.stringify({ token: 'y0_OK', state }))
    expect(await auth.consumeRedirect()).toBe(true)
    expect(auth.isConnected()).toBe(true)
    expect(store.has(OAUTH_TOKEN_KEY)).toBe(false)
  })

  test('выход стирает токен', async () => {
    const auth = createYandexAuth({ db, location, storage, envClientId: 'cid', makeDisk: () => new FakeDisk() })
    await auth.connectWithToken('y0_T')
    await auth.disconnect()
    expect(auth.isConnected()).toBe(false)
    expect(await getMeta(db, META_KEYS.yandexToken, null)).toBeNull()
  })
})
```

- [ ] **Step 2: Запустить — падает**

- [ ] **Step 3: Реализация**
  - `redirect_uri` = `new URL('oauth.html', <href без фрагмента>)` → на Pages `https://smolskiy.github.io/myAuto/oauth.html`,
    локально `http://localhost:5173/oauth.html`.
  - `loginUrl()` генерирует случайный `state` (`crypto.randomUUID()`), кладёт в `storage[OAUTH_STATE_KEY]`,
    параметры: `response_type=token`, `client_id`, `redirect_uri`, `state`, `force_confirm=yes`.
    Без ClientID бросает `Error('Укажите ClientID приложения Яндекса')`.
  - `verificationCodeUrl()` — как `tokenPageUrl` в `stats` (redirect на `VERIFICATION_URI`, без state).
  - `connectWithCode(text)` = `connectWithToken(extractToken(text))`; `connectWithToken` — `makeDisk(token).checkAccess()`,
    затем `setMeta(yandexToken)` и `onConnected?.()`.
  - `public/oauth.html` — самостоятельная страница без бандла (inline-скрипт): разобрать `location.hash`
    (`access_token`, `state`, `error`, `error_description`); при ошибке показать текст и ссылку «Вернуться в приложение»;
    при успехе `localStorage.setItem('myauto.oauth.token', JSON.stringify({ token, state }))`, очистить hash
    (`history.replaceState`) и `location.replace('./#/settings/sync')`. Приложение (`initSync`) вызывает `consumeRedirect()`.
  - `consumeRedirect` сравнивает `state` с `storage[OAUTH_STATE_KEY]`, при совпадении — `connectWithToken`, в любом случае
    удаляет `OAUTH_TOKEN_KEY` и `OAUTH_STATE_KEY`.

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit** — `git commit -m "feat(sync): Yandex login via implicit flow and verification code, oauth.html"`

---

### Task 4: Движок синхронизации

**Files:**
- Create: `src/sync/engine.ts`, `src/sync/engine.test.ts`

**Interfaces:**
- Consumes: `DiskClient`, ошибки (Task 1), `FakeDisk` (Task 2), `readSnapshot`, `applyRows`, `mergeSnapshots`, `sameSnapshot`,
  `diffTables`, `parseSnapshot`, `emptySnapshot`, `subscribeLocalChanges`, `getMeta`/`setMeta`/`META_KEYS`, `todayISO`.
- Produces:
  - `const GARAGE_PATH = 'app:/garage.json'`, `BACKUP_DIR = 'app:/backups'`, `BACKUPS_TO_KEEP = 30`
  - `interface EngineDeps { db: MyAutoDB; getDisk: () => DiskClient | null; onUnauthorized?: () => Promise<void>;
      attachments?: { uploadPending(disk: DiskClient): Promise<void>; cleanupDeleted(disk: DiskClient): Promise<void>; pendingCount(): Promise<number> };
      now?: () => number; today?: () => string; isOnline?: () => boolean; debounceMs?: number /* 2500 */; intervalMs?: number /* 300000 */ }`
  - `createSyncEngine(deps: EngineDeps): SyncEngine`

- [ ] **Step 1: Падающий тест** — `src/sync/engine.test.ts`:

```ts
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
    await Promise.all([engine.syncNow(), engine.syncNow(), engine.syncNow()])
    expect(disk.calls.filter((c) => c.startsWith('stat')).length).toBe(1)
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
    engine.start()
    await createRepos(db).places.create({ kind: 'service', name: 'СТО' })
    expect(disk.calls).toEqual([])
    await vi.advanceTimersByTimeAsync(2600)
    await vi.waitFor(() => expect(disk.peekJson(GARAGE_PATH)).toBeDefined())
    engine.stop()
  })
})
```
Оставшееся окно между последней проверкой `md5` и записью не закрыть без блокировок на Диске; если проигравший
цикл перезапишет чужую версию, чужие строки не пропадут — они лежат в базе другого устройства и уйдут в следующем цикле
(как в `stats`).

- [ ] **Step 2: Запустить — падает**

- [ ] **Step 3: Реализация — цикл (раздел 6.1 спецификации):**
  1. нет диска → `off`; `!isOnline()` → `offline`; иначе `syncing`;
  2. `stat(GARAGE_PATH)` → `remoteMd5`; `readText` → `parseSnapshot` (нет файла → `emptySnapshot()`);
     повреждённый файл на Диске → статус `error` «Файл синхронизации на Диске повреждён», ничего не записывать;
  3. `local = readSnapshot(db)`; `merged = mergeSnapshots(local, remote)`; `applyRows(db, diffTables(local.tables, merged.tables))`;
  4. если `!sameSnapshot(merged, remote)`: `stat` ещё раз; если `md5` изменился — повторить с шага 2 (до 3 попыток,
     затем `error` «Не удалось синхронизироваться — повторите позже»); иначе `writeText(GARAGE_PATH, JSON.stringify(merged))`;
  5. `attachments?.uploadPending(disk)` и `cleanupDeleted(disk)`;
  6. если `getMeta(lastBackupDate) !== today()` — `ensureFolder(BACKUP_DIR)`, `copy(GARAGE_PATH, BACKUP_DIR/<today>.json)`,
     удалить самые старые сверх 30 (сортировка имён), `setMeta(lastBackupDate)`;
  7. `idle`, `lastSyncAt = now()`, `setMeta(lastSyncAt)`, `pendingUploads = attachments?.pendingCount() ?? 0`.
  Ошибки: `Unauthorized` → `onUnauthorized()`, `error`; `Offline` → `offline`; прочие `YandexError`/`Error` → `error` с `message`.
  `syncNow` при идущем цикле возвращает тот же промис. `start()`: `subscribeLocalChanges` → debounce `debounceMs`;
  `document.visibilitychange` (visible) и `window.online` → `syncNow`; `setInterval(intervalMs)`; сразу `syncNow('start')`.
  `stop()` снимает всё.

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit** — `git commit -m "feat(sync): sync engine with race-safe upload, daily backups, triggers"`

---

### Task 5: Вложения — сжатие, очередь загрузки, кеш

**Files:**
- Create: `src/sync/image.ts`, `src/sync/attachments.ts`, `src/sync/attachments.test.ts`

**Interfaces:**
- Consumes: `createRepos` (строки `attachments`), `BlobRow`, `DiskClient`, `FakeDisk`.
- Produces:
  - `image.ts`: `interface Compressed { blob: Blob; width: number; height: number }`,
    `compressImage(file: Blob, maxSide: number, quality: number): Promise<Compressed>` (Canvas; `createImageBitmap(file, { imageOrientation: 'from-image' })`)
  - `attachments.ts`: `const MAX_PDF_BYTES = 20 * 1024 * 1024`, `CACHE_LIMIT_BYTES = 200 * 1024 * 1024`,
    `remotePaths(att: Attachment): { orig: string; thumb?: string }`,
    `createAttachmentStore(deps: { db: MyAutoDB; getDisk: () => DiskClient | null; compress?: typeof compressImage;
      createObjectURL?: (b: Blob) => string; onChanged?: () => void }): AttachmentStore & {
      uploadPending(disk: DiskClient): Promise<void>; cleanupDeleted(disk: DiskClient): Promise<void>; evictCache(limitBytes?: number): Promise<void> }`

- [ ] **Step 1: Падающий тест** — `src/sync/attachments.test.ts`:

```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { MyAutoDB } from '../db/schema'
import { FakeDisk } from './yandex/fakeDisk'
import { createAttachmentStore, remotePaths } from './attachments'

let db: MyAutoDB, disk: FakeDisk
const compress = vi.fn(async (_f: Blob, maxSide: number) => ({ blob: new Blob([`jpeg${maxSide}`], { type: 'image/jpeg' }), width: maxSide, height: maxSide / 2 }))
const urls = vi.fn((b: Blob) => `blob:${b.size}`)
const store = (online = true) => createAttachmentStore({ db, getDisk: () => (online ? disk : null), compress, createObjectURL: urls })
const owner = { ownerType: 'record' as const, ownerId: 'r1' }
beforeEach(() => { db = new MyAutoDB(`t-${crypto.randomUUID()}`); disk = new FakeDisk() })
afterEach(async () => { await db.delete() })

test('фото сжимается до 2000 и 320 px и ждёт загрузки', async () => {
  const s = store()
  const att = await s.addFile(owner, new File(['raw'], 'check.jpg', { type: 'image/jpeg' }))
  expect(att).toMatchObject({ kind: 'photo', mime: 'image/jpeg', name: 'check.jpg', width: 2000, height: 1000, ownerId: 'r1' })
  expect(compress).toHaveBeenCalledWith(expect.any(File), 2000, 0.82)
  expect(compress).toHaveBeenCalledWith(expect.any(File), 320, 0.7)
  expect(await s.pendingCount()).toBe(2)
  expect(await s.getThumbUrl(att)).toMatch(/^blob:/)
})

test('PDF больше 20 МБ и неподдерживаемый тип — понятная ошибка', async () => {
  const s = store()
  const big = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'scan.pdf', { type: 'application/pdf' })
  await expect(s.addFile(owner, big)).rejects.toThrow('PDF больше 20 МБ — сожмите файл')
  await expect(s.addFile(owner, new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow('Можно прикрепить фото или PDF')
})

test('загрузка на Диск снимает pending и ставит uploadedAt', async () => {
  const s = store()
  const att = await s.addFile(owner, new File(['raw'], 'check.jpg', { type: 'image/jpeg' }))
  await s.uploadPending(disk)
  const { orig, thumb } = remotePaths(att)
  expect(orig).toBe(`app:/attachments/${att.id}.jpg`)
  expect(thumb).toBe(`app:/attachments/${att.id}.thumb.jpg`)
  expect(disk.files.has(orig)).toBe(true)
  expect(disk.files.has(thumb!)).toBe(true)
  expect(await s.pendingCount()).toBe(0)
  expect((await db.attachments.get(att.id))?.uploadedAt).toBeTypeOf('number')
})

test('на другом устройстве превью скачивается с Диска и кешируется', async () => {
  const s = store()
  const att = await s.addFile(owner, new File(['raw'], 'check.jpg', { type: 'image/jpeg' }))
  await s.uploadPending(disk)
  const uploaded = (await db.attachments.get(att.id))!
  const other = new MyAutoDB(`t-${crypto.randomUUID()}`)
  await other.attachments.put(uploaded)
  const s2 = createAttachmentStore({ db: other, getDisk: () => disk, compress, createObjectURL: urls })
  expect(await s2.getThumbUrl(uploaded)).toMatch(/^blob:/)
  expect(await other.blobs.get(`${att.id}:thumb`)).toMatchObject({ pending: 0 })
  await other.delete()
})

test('удалённое вложение чистится на Диске и локально', async () => {
  const s = store()
  const att = await s.addFile(owner, new File(['raw'], 'check.jpg', { type: 'image/jpeg' }))
  await s.uploadPending(disk)
  await s.remove((await db.attachments.get(att.id))!)
  await s.cleanupDeleted(disk)
  expect(disk.files.has(remotePaths(att).orig)).toBe(false)
  expect(await db.blobs.where('attachmentId').equals(att.id).count()).toBe(0)
})

test('кеш вытесняет старые загруженные оригиналы, но не неотправленные', async () => {
  const s = store()
  const a = await s.addFile(owner, new File(['1'], 'a.jpg', { type: 'image/jpeg' }))
  await s.uploadPending(disk)
  const b = await s.addFile(owner, new File(['2'], 'b.jpg', { type: 'image/jpeg' }))
  await s.evictCache(1) // лимит 1 байт
  expect(await db.blobs.get(`${a.id}:orig`)).toBeUndefined()   // загружен — можно вытеснить
  expect(await db.blobs.get(`${a.id}:thumb`)).toBeDefined()     // превью не вытесняются
  expect(await db.blobs.get(`${b.id}:orig`)).toBeDefined()      // не загружен — нельзя
})
```

- [ ] **Step 2: Запустить — падает**

- [ ] **Step 3: Реализация**: фото → `compress(file, 2000, 0.82)` и `compress(file, 320, 0.7)`, `mime: 'image/jpeg'`;
  PDF → без сжатия, без превью; строка через `createRepos(db).attachments.create` (это вызовет синхронизацию строки),
  файлы — `db.blobs.put({ key, attachmentId, variant, blob, pending: 1, size, lastAccess: Date.now() })`.
  `getThumbUrl`/`getOriginalUrl`: локальный blob (обновить `lastAccess`) → иначе, если `uploadedAt` и есть диск,
  `downloadBlob` → сохранить с `pending: 0` → `createObjectURL`; иначе `null`. `uploadPending`: все `pending = 1` →
  `uploadBlob` → `pending = 0`; когда у вложения не осталось pending — `attachments.update(id, { uploadedAt })`.
  `cleanupDeleted`: удалённые строки с `uploadedAt` → `disk.remove` обоих путей; локальные blobs удалить; список уже
  очищенных id — в `meta` (`sync.cleanedAttachments`), чтобы не повторять. `evictCache` — только `variant: 'orig'` с `pending: 0`,
  по возрастанию `lastAccess`, пока сумма `size` всех blobs > лимита.

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit** — `git commit -m "feat(sync): photo compression, attachment upload queue and cache"`

---

### Task 6: Бэкапы, выгрузка и загрузка JSON, Excel

**Files:**
- Create: `src/sync/backup.ts`, `src/sync/excel.ts`, `src/sync/saveFile.ts`, `src/sync/backup.test.ts`

**Interfaces:**
- Consumes: `readSnapshot`, `applyRows`, `replaceAll`, `emitLocalChange`, `parseSnapshot`, `mergeSnapshots`, `diffTables`, `TABLE_NAMES`.
- Produces:
  - `createBackupService(deps: { db: MyAutoDB; now?: () => number }): BackupService`
  - `excel.ts`: `buildWorkbook(snapshot: Snapshot): Promise<Blob>` — ленивый `import('xlsx')`; листы «Машины», «Журнал»,
    «Запчасти», «Работы», «Заправки», «Расходы», «Напоминания»; суммы — в рублях числами; только живые строки
  - `saveFile.ts`: `saveFile(blob: Blob, filename: string): Promise<void>` — `navigator.share({ files })`, если доступно и
    это телефон, иначе `<a download>`; `backupFileName(kind: 'json' | 'xlsx', today: string): string` →
    `moy-avto-2026-09-25.json`

- [ ] **Step 1: Падающий тест** — `src/sync/backup.test.ts`:

```ts
import { afterEach, beforeEach, expect, test } from 'vitest'
import * as XLSX from 'xlsx'
import { MyAutoDB } from '../db/schema'
import { createRepos } from '../db/repos'
import { subscribeLocalChanges } from '../db/changes'
import { createBackupService } from './backup'
import { backupFileName } from './saveFile'

let db: MyAutoDB
beforeEach(() => { db = new MyAutoDB(`t-${crypto.randomUUID()}`) })
afterEach(async () => { await db.delete() })

const asFile = async (b: Blob, name = 'backup.json') => new File([await b.text()], name, { type: 'application/json' })

test('выгрузка → предпросмотр → замена', async () => {
  const repos = createRepos(db)
  await repos.places.create({ kind: 'service', name: 'СТО' })
  const svc = createBackupService({ db })
  const file = await asFile(await svc.exportJson())
  const preview = await svc.previewImport(file)
  expect(preview.counts.places).toBe(1)
  expect(preview.counts.records).toBe(0)
  await repos.places.create({ kind: 'fuel', name: 'АЗС' })
  await svc.importJson(file, 'replace')
  expect((await db.places.toArray()).map((p) => p.name)).toEqual(['СТО'])
})

test('объединение не затирает более новые локальные правки и запускает синхронизацию', async () => {
  const repos = createRepos(db)
  const p = await repos.places.create({ kind: 'service', name: 'Старое имя' })
  const svc = createBackupService({ db })
  const oldFile = await asFile(await svc.exportJson())
  await repos.places.update(p.id, { name: 'Новое имя' })
  const seen: string[] = []
  const off = subscribeLocalChanges((t) => seen.push(t))
  await svc.importJson(oldFile, 'merge')
  off()
  expect((await db.places.get(p.id))?.name).toBe('Новое имя')
  expect(seen.length).toBeGreaterThan(0)
})

test('чужой файл — понятная ошибка', async () => {
  const svc = createBackupService({ db })
  await expect(svc.previewImport(new File(['{"x":1}'], 'x.json'))).rejects.toThrow('Это не файл «Мой авто»')
  await expect(svc.previewImport(new File(['не json'], 'x.json'))).rejects.toThrow('Это не файл «Мой авто»')
})

test('Excel: листы и строка запчасти', async () => {
  const repos = createRepos(db)
  const v = await repos.vehicles.create({ name: 'Октавия', make: 'Skoda', model: 'Octavia', archived: false, fluids: [], order: 0 })
  await repos.records.create({ vehicleId: v.id, kind: 'service', date: '2026-09-12', odometer: 145100, total: 1245000,
    title: 'ТО-15', serviceType: 'maintenance', diy: false, works: [],
    parts: [{ id: 'p', name: 'Масляный фильтр', brand: 'Mann-Filter', partNumber: 'W 712/95', qty: 1, unit: 'pcs', unitPrice: 65000, ownPart: true }] })
  const blob = await createBackupService({ db }).exportExcel()
  const wb = XLSX.read(await blob.arrayBuffer())
  expect(wb.SheetNames).toEqual(['Машины', 'Журнал', 'Запчасти', 'Работы', 'Заправки', 'Расходы', 'Напоминания'])
  const parts = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Запчасти']!)
  expect(parts[0]).toMatchObject({ Машина: 'Октавия', Дата: '2026-09-12', Бренд: 'Mann-Filter', Артикул: 'W 712/95', 'Цена, ₽': 650 })
})

test('имя файла бэкапа', () => {
  expect(backupFileName('json', '2026-09-25')).toBe('moy-avto-2026-09-25.json')
})
```

- [ ] **Step 2: Запустить — падает**

- [ ] **Step 3: Реализация**: `exportJson` — `JSON.stringify(await readSnapshot(db, now()))`, `application/json`;
  `previewImport` — `JSON.parse` (ошибка → `SnapshotError('Это не файл «Мой авто»')`) → `parseSnapshot` → число живых строк
  по `TABLE_NAMES`; `importJson('merge')` — `mergeSnapshots(local, imported)` → `applyRows(diffTables)` → `emitLocalChange`
  для каждой изменённой таблицы; `importJson('replace')` — `replaceAll` → `emitLocalChange('vehicles')`.
  Excel — столбцы с русскими заголовками: «Журнал» (Машина, Дата, Тип, Название, Пробег, Сумма ₽, Место, Заметка),
  «Запчасти» (Машина, Дата, Пробег, Узел, Название, Бренд, Артикул, Кол-во, Ед., Цена ₽, Своя), «Работы», «Заправки»
  (…Литры, Цена за литр ₽, Полный бак, Марка), «Расходы» (…Категория, Действует до), «Напоминания» (Машина, Название,
  Интервал км, Интервал мес.).

- [ ] **Step 4: PASS**

- [ ] **Step 5: Commit** — `git commit -m "feat(sync): JSON backup export/import with merge, Excel export"`

---

### Task 7: Сборка синглтонов и React-хуки слоя

**Files:**
- Create: `src/sync/index.ts`, `src/sync/react.ts`, `src/sync/index.test.ts`

**Interfaces:**
- Consumes: всё выше; `db` (`db/instance.ts`).
- Produces:
  - `index.ts`: `yandexAuth`, `attachmentStore`, `syncEngine`, `backupService` (боевые экземпляры на `db`),
    `initSync(): Promise<void>` — `navigator.storage?.persist?.()`, `yandexAuth.init()`, `yandexAuth.consumeRedirect()`,
    `syncEngine.start()`; повторный вызов — без эффекта
  - `react.ts`: `useSyncStatus(): SyncStatus` (через `useSyncExternalStore`), `useYandexConnected(): boolean`,
    `useAttachmentUrl(att: Attachment | undefined, variant: 'thumb' | 'orig'): string | null | undefined` (отзывает object URL при размонтировании)

- [ ] **Step 1: Падающий тест** — `src/sync/index.test.ts`:

```ts
import { renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import { initSync, syncEngine } from './index'
import { useSyncStatus } from './react'

test('без подключения статус off, повторный initSync безопасен', async () => {
  await initSync()
  await initSync()
  await syncEngine.syncNow()
  const { result } = renderHook(() => useSyncStatus())
  expect(result.current.state).toBe('off')
  syncEngine.stop()
})
```

- [ ] **Step 2–4: Реализовать до PASS**, затем `npm run typecheck && npm run lint && npm test && npm run build`.

- [ ] **Step 5: Commit** — `git commit -m "feat(sync): wire production services and React hooks"`

---

## Отчёт агента по завершении

1. Задачи и коммиты.
2. Что проверено только на фейковом Диске и требует живой проверки (живой вход, CORS загрузки файлов в Safari).
3. Нужны ли изменения замороженных контрактов или файлов волны 0 — с обоснованием.
4. Вывод `npm run typecheck && npm run lint && npm test`.
