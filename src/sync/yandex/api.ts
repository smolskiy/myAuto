/**
 * Минимальный клиент REST API Яндекс.Диска (перенесён из проекта stats и расширен).
 *
 * Приложение видит только свою папку на Диске («Приложения/Мой авто»), в API — `app:/`.
 * Токен передаётся только в заголовке Authorization и никуда не пишется.
 */

const API = 'https://cloud-api.yandex.net/v1/disk'

export class YandexError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = new.target.name
    this.status = status
  }
}

export class Unauthorized extends YandexError {}
export class NoSpace extends YandexError {}
export class Offline extends YandexError {}

export interface ResourceStat {
  md5?: string
  size?: number
  modified?: string
}

export interface DiskClient {
  checkAccess(): Promise<void>
  stat(path: string): Promise<ResourceStat | null>
  readText(path: string): Promise<string | null>
  downloadBlob(path: string): Promise<Blob | null>
  writeText(path: string, text: string, contentType?: string): Promise<void>
  uploadBlob(path: string, blob: Blob, contentType: string): Promise<void>
  ensureFolder(path: string): Promise<void>
  copy(from: string, to: string): Promise<void>
  /** 404 — не ошибка. */
  remove(path: string): Promise<void>
  /** Имена файлов в папке; нет папки → []. */
  list(dir: string): Promise<string[]>
}

const q = (path: string) => `path=${encodeURIComponent(path)}`

function hostOf(href: string): string {
  try {
    return new URL(href).host
  } catch {
    return '?'
  }
}

async function fail(res: Response, what: string): Promise<never> {
  let detail = ''
  try {
    const body = (await res.json()) as { message?: string; description?: string; error?: string }
    detail = body.message || body.description || body.error || ''
  } catch {
    /* тело не JSON */
  }
  console.warn(what, res.status, detail)
  throw new YandexError(what, res.status)
}

const OFFLINE_TEXT = 'Нет связи с Яндекс.Диском'
const errorText = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : String(e))

export function createDiskClient(token: string, fetchImpl?: typeof fetch): DiskClient {
  const doFetch: typeof fetch = fetchImpl ?? ((input, init) => fetch(input, init))

  async function api(path: string, init: RequestInit = {}): Promise<Response> {
    let res: Response
    try {
      res = await doFetch(`${API}${path}`, {
        ...init,
        headers: { Authorization: `OAuth ${token}`, Accept: 'application/json', ...(init.headers ?? {}) },
      })
    } catch (e) {
      console.warn('Запрос к Яндекс.Диску не прошёл', errorText(e))
      throw new Offline(OFFLINE_TEXT, 0)
    }
    if (res.status === 401) throw new Unauthorized('Вход в Яндекс истёк — войдите заново', 401)
    if (res.status === 507) throw new NoSpace('На Яндекс.Диске нет места', 507)
    return res
  }

  /**
   * Файл отдаёт отдельный сервер Яндекса (downloader…, затем storage…) через редирект.
   * Safari строже Chrome к таким запросам, поэтому при неудаче повторяем «чистый» запрос:
   * без cookie, без Referer и без кеша. Хост и подробность отказа — только в console.warn (по ним видно,
   * на каком шаге и почему браузер отказал); наружу — Offline, чтобы цикл повторился по расписанию.
   */
  async function download<T>(href: string, read: (res: Response) => Promise<T>): Promise<T> {
    const attempts: RequestInit[] = [
      {},
      { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', mode: 'cors' },
    ]
    let status = 0
    let detail = ''
    for (const init of attempts) {
      try {
        const file = await doFetch(href, init)
        if (file.ok) return await read(file)
        status = file.status
        detail = `код ${file.status}`
      } catch (e) {
        status = 0
        detail = errorText(e)
      }
    }
    console.warn('Скачивание с Диска не удалось', hostOf(href), detail)
    if (status === 0) throw new Offline(OFFLINE_TEXT, 0)
    throw new YandexError('Не удалось скачать файл с Диска', status)
  }

  async function fetchFile<T>(path: string, read: (res: Response) => Promise<T>): Promise<T | null> {
    const res = await api(`/resources/download?${q(path)}`)
    if (res.status === 404) return null
    if (!res.ok) return fail(res, 'Не удалось получить ссылку на файл')
    const { href } = (await res.json()) as { href: string }
    return download(href, read)
  }

  async function upload(path: string, body: BodyInit, contentType: string): Promise<void> {
    const res = await api(`/resources/upload?${q(path)}&overwrite=true`)
    if (!res.ok) return fail(res, 'Не удалось получить адрес для загрузки')
    const { href, method } = (await res.json()) as { href: string; method?: string }
    let put: Response
    try {
      put = await doFetch(href, { method: method || 'PUT', body, headers: { 'Content-Type': contentType } })
    } catch (e) {
      // Хост и подробность — только в console.warn (диагностика Safari); наружу — Offline, цикл повторится.
      console.warn('Загрузка на Диск не удалась', hostOf(href), errorText(e))
      throw new Offline(OFFLINE_TEXT, 0)
    }
    if (put.status === 507) throw new NoSpace('На Яндекс.Диске нет места', 507)
    if (!put.ok && put.status !== 201 && put.status !== 202) {
      console.warn('Загрузка на Диск не удалась', hostOf(href), put.status)
      throw new YandexError('Не удалось загрузить файл на Диск', put.status)
    }
  }

  return {
    /**
     * Проверка токена. Спрашиваем не сведения о Диске, а свою папку: у приложения доступ только к ней.
     * Папки может ещё не быть (404) — это нормально, она появится при первой записи.
     */
    async checkAccess() {
      const res = await api(`/resources?${q('app:/')}&limit=1`)
      if (res.ok || res.status === 404) return
      if (res.status === 403) {
        throw new YandexError(
          'Яндекс не дал доступ к Диску. Проверьте на oauth.yandex.ru, что у приложения отмечен доступ «Доступ к папке приложения на Диске», и войдите заново',
          403,
        )
      }
      return fail(res, 'Не удалось открыть Диск')
    },

    async stat(path) {
      const res = await api(`/resources?${q(path)}&fields=md5,size,modified`)
      if (res.status === 404) return null
      if (!res.ok) return fail(res, 'Не удалось получить сведения о файле')
      const body = (await res.json()) as ResourceStat
      const stat: ResourceStat = {}
      if (body.md5 !== undefined) stat.md5 = body.md5
      if (body.size !== undefined) stat.size = body.size
      if (body.modified !== undefined) stat.modified = body.modified
      return stat
    },

    readText: (path) => fetchFile(path, (res) => res.text()),

    downloadBlob: (path) => fetchFile(path, (res) => res.blob()),

    writeText: (path, text, contentType = 'application/json') => upload(path, text, contentType),

    uploadBlob: (path, blob, contentType) => upload(path, blob, contentType),

    async ensureFolder(path) {
      const res = await api(`/resources?${q(path)}`, { method: 'PUT' })
      if (res.ok || res.status === 409) return // 409 — папка уже есть
      return fail(res, 'Не удалось создать папку')
    },

    /** Копия на стороне Диска — без повторной загрузки файла с телефона. */
    async copy(from, to) {
      const res = await api(`/resources/copy?from=${encodeURIComponent(from)}&${q(to)}&overwrite=true`, { method: 'POST' })
      if (res.ok || res.status === 201 || res.status === 202) return
      return fail(res, 'Не удалось сделать копию')
    },

    async remove(path) {
      const res = await api(`/resources?${q(path)}&permanently=true`, { method: 'DELETE' })
      if (res.ok || res.status === 202 || res.status === 204 || res.status === 404) return
      return fail(res, 'Не удалось удалить файл')
    },

    async list(dir) {
      const res = await api(`/resources?${q(dir)}&limit=1000&fields=_embedded.items.name,_embedded.items.type`)
      if (res.status === 404) return []
      if (!res.ok) return fail(res, 'Не удалось прочитать папку')
      const body = (await res.json()) as { _embedded?: { items?: { name: string; type: string }[] } }
      return (body._embedded?.items ?? []).filter((i) => i.type === 'file').map((i) => i.name)
    },
  }
}
