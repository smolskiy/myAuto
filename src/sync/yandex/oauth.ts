import type { MyAutoDB } from '../../db/schema'
import { META_KEYS, deleteMeta, getMeta, setMeta } from '../../db/meta'
import type { YandexAuth } from '../contracts'
import { Offline, Unauthorized, YandexError, createDiskClient, type DiskClient } from './api'

/**
 * Вход в Яндекс.
 *
 * Основной путь — implicit flow: Яндекс возвращает на `oauth.html` с `#access_token=…&state=…`,
 * страница кладёт токен и state в localStorage и уходит в приложение, а `consumeRedirect` принимает
 * токен, только если state совпал с выданным перед входом (защита от подделки и старых вкладок).
 * Запасной путь (как в stats) — страница Яндекса с кодом подтверждения, код вставляют вручную.
 *
 * Токен хранится только в `meta` и не попадает ни в URL приложения, ни в логи.
 */

export const OAUTH_STATE_KEY = 'myauto.oauth.state'
export const OAUTH_TOKEN_KEY = 'myauto.oauth.token'
export const VERIFICATION_URI = 'https://oauth.yandex.ru/verification_code'
const AUTHORIZE_URI = 'https://oauth.yandex.ru/authorize'

const STATE_MISMATCH = 'Вход не подтверждён — войдите ещё раз'

/** Ошибка входа с готовым текстом для человека. */
class LoginFailure extends Error {}

/** Текст неудачи входа для экрана. Техническая деталь — только в console.warn. */
function loginErrorText(e: unknown): string {
  if (e instanceof Unauthorized) return 'Код не подошёл — получите новый'
  if (e instanceof Offline) return 'Нет связи — войдите ещё раз, когда появится сеть'
  if (e instanceof YandexError || e instanceof LoginFailure) return e.message
  console.warn('Вход в Яндекс не удался', e)
  return 'Не удалось войти — попробуйте ещё раз'
}

/** Ошибка, которую Яндекс вернул на oauth.html (`#error=…&error_description=…`). */
function yandexErrorText(error: string, description: string): string {
  if (error === 'access_denied') return 'Вход отменён'
  if (error === 'invalid_client' || error === 'unauthorized_client') return 'Яндекс не узнал приложение — проверьте ClientID'
  return description ? `Яндекс отказал во входе: ${description}` : 'Яндекс отказал во входе'
}

interface Handoff {
  token?: unknown
  error?: unknown
  errorDescription?: unknown
  state?: unknown
}

/** Из вставленного текста достаём сам токен: люди копируют и с пробелами, и целым адресом. */
export function extractToken(text: string): string {
  const t = text.trim()
  const m = /access_token=([^&\s]+)/.exec(t)
  return (m ? m[1]! : t).replace(/\s+/g, '')
}

export interface YandexAuthDeps {
  db: MyAutoDB
  location: Pick<Location, 'href'>
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  makeDisk?: (token: string) => DiskClient
  envClientId?: string
  onConnected?: () => void
}

export type YandexAuthService = YandexAuth & {
  /** Читает токен и ClientID из meta в память. */
  init(): Promise<void>
  getToken(): string | null
  /**
   * Забирает то, что оставил oauth.html. true — вход состоялся; false — входа не было или он не удался
   * (текст — в getLoginError). Не бросает.
   */
  consumeRedirect(): Promise<boolean>
}

export function createYandexAuth(deps: YandexAuthDeps): YandexAuthService {
  const { db, location, storage } = deps
  const makeDisk = deps.makeDisk ?? ((token: string) => createDiskClient(token))
  const envClientId = deps.envClientId?.trim() || null
  let token: string | null = null
  let manualClientId: string | null = null
  let loginError: string | null = null
  const subscribers = new Set<() => void>()
  const notify = () => {
    for (const cb of subscribers) cb()
  }
  const setToken = (value: string | null) => {
    token = value
    notify()
  }
  const setLoginError = (text: string | null) => {
    if (text === loginError) return
    loginError = text
    notify()
  }

  const clientIdOrThrow = (): string => {
    const id = manualClientId ?? envClientId
    if (!id) throw new Error('Укажите ClientID приложения Яндекса')
    return id
  }

  const authorizeUrl = (params: Record<string, string>) => `${AUTHORIZE_URI}?${new URLSearchParams(params)}`

  const auth: YandexAuthService = {
    async init() {
      manualClientId = await getMeta<string | null>(db, META_KEYS.yandexClientId, null)
      setToken(await getMeta<string | null>(db, META_KEYS.yandexToken, null))
    },

    subscribe(cb) {
      subscribers.add(cb)
      return () => {
        subscribers.delete(cb)
      }
    },

    getLoginError: () => loginError,

    getToken: () => token,

    isConnected: () => token !== null,

    getClientId: () => manualClientId ?? envClientId,

    setClientId(clientId) {
      const id = clientId.trim() || null
      manualClientId = id
      const saved = id ? setMeta(db, META_KEYS.yandexClientId, id) : deleteMeta(db, META_KEYS.yandexClientId)
      saved.catch((e: unknown) => console.warn('ClientID не сохранился', e))
    },

    /**
     * Вызывать только в обработчике нажатия «Войти», прямо перед переходом: каждый вызов пишет новый
     * state в storage, и возврат с oauth.html примется только с последним выданным.
     */
    loginUrl() {
      const clientId = clientIdOrThrow()
      const state = crypto.randomUUID()
      storage.setItem(OAUTH_STATE_KEY, state)
      setLoginError(null)
      const appBase = location.href.split('#')[0]!
      return authorizeUrl({
        response_type: 'token',
        client_id: clientId,
        redirect_uri: new URL('oauth.html', appBase).href,
        state,
        force_confirm: 'yes',
      })
    },

    verificationCodeUrl() {
      return authorizeUrl({
        response_type: 'token',
        client_id: clientIdOrThrow(),
        redirect_uri: VERIFICATION_URI,
        force_confirm: 'yes',
      })
    },

    /** Проверяет доступ и сохраняет токен. Неудача — текст в getLoginError и исключение с тем же текстом. */
    async connectWithToken(raw) {
      try {
        const value = raw.trim()
        if (!value) throw new LoginFailure('Вставьте код из Яндекса')
        await makeDisk(value).checkAccess()
        await setMeta(db, META_KEYS.yandexToken, value)
        loginError = null
        setToken(value)
      } catch (e) {
        const text = loginErrorText(e)
        setLoginError(text)
        throw new Error(text, { cause: e })
      }
      deps.onConnected?.()
    },

    connectWithCode: (text) => auth.connectWithToken(extractToken(text)),

    async disconnect() {
      await deleteMeta(db, META_KEYS.yandexToken)
      setToken(null)
    },

    async consumeRedirect() {
      const raw = storage.getItem(OAUTH_TOKEN_KEY)
      if (raw === null) return false
      const expected = storage.getItem(OAUTH_STATE_KEY)
      // Оставленный токен забираем всегда. State выданного входа — только при совпадении:
      // поддельный или старый возврат не должен ломать вход, который ещё идёт.
      storage.removeItem(OAUTH_TOKEN_KEY)
      let payload: Handoff
      try {
        payload = JSON.parse(raw) as Handoff
      } catch {
        console.warn('Вход в Яндекс: повреждённые данные возврата')
        setLoginError(STATE_MISMATCH)
        return false
      }
      if (!expected || payload.state !== expected) {
        console.warn('Вход в Яндекс отклонён: state не совпал')
        setLoginError(STATE_MISMATCH)
        return false
      }
      storage.removeItem(OAUTH_STATE_KEY)
      if (typeof payload.error === 'string') {
        const description = typeof payload.errorDescription === 'string' ? payload.errorDescription : ''
        setLoginError(yandexErrorText(payload.error, description))
        return false
      }
      if (typeof payload.token !== 'string') {
        setLoginError(STATE_MISMATCH)
        return false
      }
      try {
        await auth.connectWithToken(payload.token)
        return true
      } catch {
        return false // текст уже в getLoginError
      }
    },
  }
  return auth
}
