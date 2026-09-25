import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { MyAutoDB } from '../../db/schema'
import { META_KEYS, getMeta } from '../../db/meta'
import { FakeDisk } from './fakeDisk'
import { OAUTH_STATE_KEY, OAUTH_TOKEN_KEY, createYandexAuth, extractToken } from './oauth'
import { Offline, Unauthorized, YandexError } from './api'

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

  test('подписчики узнают о входе и выходе', async () => {
    const auth = createYandexAuth({ db, location, storage, envClientId: 'cid', makeDisk: () => new FakeDisk() })
    const seen: boolean[] = []
    const off = auth.subscribe(() => seen.push(auth.isConnected()))
    await auth.connectWithToken('y0_T')
    await auth.disconnect()
    off()
    await auth.connectWithToken('y0_T')
    expect(seen).toEqual([true, false])
  })

  test.each([
    ['access_denied', 'The user denied access', 'Вход отменён'],
    ['invalid_client', '', 'Яндекс не узнал приложение — проверьте ClientID'],
    ['server_error', 'Сбой', 'Яндекс отказал во входе: Сбой'],
  ])('ошибка %s из oauth.html видна приложению', async (error, errorDescription, text) => {
    const auth = createYandexAuth({ db, location, storage, envClientId: 'cid', makeDisk: () => new FakeDisk() })
    const state = new URL(auth.loginUrl()).searchParams.get('state')!
    const notified = vi.fn()
    auth.subscribe(notified)
    store.set(OAUTH_TOKEN_KEY, JSON.stringify({ error, errorDescription, state }))
    expect(await auth.consumeRedirect()).toBe(false)
    expect(auth.getLoginError()).toBe(text)
    expect(notified).toHaveBeenCalled()
    expect(store.has(OAUTH_TOKEN_KEY)).toBe(false)
  })

  test('чужой state — ошибка входа', async () => {
    const auth = createYandexAuth({ db, location, storage, envClientId: 'cid', makeDisk: () => new FakeDisk() })
    auth.loginUrl()
    store.set(OAUTH_TOKEN_KEY, JSON.stringify({ token: 'y0_OK', state: 'forged' }))
    expect(await auth.consumeRedirect()).toBe(false)
    expect(auth.getLoginError()).toBe('Вход не подтверждён — войдите ещё раз')
  })

  test('отказ в доступе к Диску — текст с подсказкой в ошибке входа', async () => {
    const disk = new FakeDisk()
    disk.failNext(new YandexError('Яндекс не дал доступ к Диску. Проверьте на oauth.yandex.ru доступ к папке приложения', 403))
    const auth = createYandexAuth({ db, location, storage, envClientId: 'cid', makeDisk: () => disk })
    await expect(auth.connectWithCode('y0_T')).rejects.toThrow('Яндекс не дал доступ к Диску')
    expect(auth.getLoginError()).toBe('Яндекс не дал доступ к Диску. Проверьте на oauth.yandex.ru доступ к папке приложения')
  })

  test('нет сети при возврате с oauth.html — просьба войти, когда появится сеть', async () => {
    const disk = new FakeDisk()
    disk.failNext(new Offline('Нет связи с Яндекс.Диском', 0))
    const auth = createYandexAuth({ db, location, storage, envClientId: 'cid', makeDisk: () => disk })
    const state = new URL(auth.loginUrl()).searchParams.get('state')!
    store.set(OAUTH_TOKEN_KEY, JSON.stringify({ token: 'y0_OK', state }))
    expect(await auth.consumeRedirect()).toBe(false)
    expect(auth.isConnected()).toBe(false)
    expect(auth.getLoginError()).toBe('Нет связи — войдите ещё раз, когда появится сеть')
  })

  test('401 при вводе кода — код не подошёл', async () => {
    const disk = new FakeDisk()
    disk.failNext(new Unauthorized('Вход в Яндекс истёк — войдите заново', 401))
    const auth = createYandexAuth({ db, location, storage, envClientId: 'cid', makeDisk: () => disk })
    await expect(auth.connectWithCode('y0_OLD')).rejects.toThrow('Код не подошёл — получите новый')
    expect(auth.getLoginError()).toBe('Код не подошёл — получите новый')
  })

  test('ошибка входа сбрасывается новым входом', async () => {
    const disk = new FakeDisk()
    const auth = createYandexAuth({ db, location, storage, envClientId: 'cid', makeDisk: () => disk })
    disk.failNext(new Unauthorized('Вход в Яндекс истёк — войдите заново', 401))
    await auth.connectWithCode('y0_OLD').catch(() => {})
    auth.loginUrl()
    expect(auth.getLoginError()).toBeNull()
    disk.failNext(new Unauthorized('Вход в Яндекс истёк — войдите заново', 401))
    await auth.connectWithCode('y0_OLD').catch(() => {})
    await auth.connectWithCode('y0_NEW')
    expect(auth.getLoginError()).toBeNull()
  })

  test('выход стирает токен', async () => {
    const auth = createYandexAuth({ db, location, storage, envClientId: 'cid', makeDisk: () => new FakeDisk() })
    await auth.connectWithToken('y0_T')
    await auth.disconnect()
    expect(auth.isConnected()).toBe(false)
    expect(await getMeta(db, META_KEYS.yandexToken, null)).toBeNull()
  })
})
