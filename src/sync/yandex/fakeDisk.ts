import { YandexError, type DiskClient, type ResourceStat } from './api'

interface FakeFile {
  data: string | Blob
  md5: string
  modified: string
}

interface Failure {
  error: Error
  method?: keyof DiskClient
  times: number
}

/** Детерминированный «md5»: длина + полиномиальная сумма кодов. Меняется при изменении содержимого. */
function hash(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return `${text.length}-${h.toString(16)}`
}

const contentOf = async (data: string | Blob): Promise<string> => (typeof data === 'string' ? data : data.text())

/**
 * Яндекс.Диск в памяти для тестов: те же ответы, что у настоящего клиента
 * (нет файла → null, 404 при удалении — не ошибка), плюс крючки для сбоев и гонок.
 */
export class FakeDisk implements DiskClient {
  files = new Map<string, FakeFile>()
  /** Журнал вызовов: `"<метод> <путь>"`. */
  calls: string[] = []
  /** Крючок для гонок: вызывается после того, как readText прочитал файл, и до возврата результата. */
  afterRead?: (path: string) => void | Promise<void>

  private failures: Failure[] = []
  private clock = 0

  /** Следующий вызов (или `times` вызовов указанного метода) бросит `error`. */
  failNext(error: Error, opts: { method?: keyof DiskClient; times?: number } = {}): void {
    this.failures.push({ error, method: opts.method, times: opts.times ?? 1 })
  }

  peekJson<T>(path: string): T | undefined {
    const file = this.files.get(path)
    return file && typeof file.data === 'string' ? (JSON.parse(file.data) as T) : undefined
  }

  private enter(method: keyof DiskClient, path: string): void {
    this.calls.push(`${method} ${path}`)
    const i = this.failures.findIndex((f) => !f.method || f.method === method)
    if (i < 0) return
    const failure = this.failures[i]!
    failure.times -= 1
    if (failure.times <= 0) this.failures.splice(i, 1)
    throw failure.error
  }

  private async put(path: string, data: string | Blob): Promise<void> {
    this.clock += 1
    const md5 = hash(await contentOf(data))
    this.files.set(path, { data, md5, modified: new Date(Date.UTC(2026, 0, 1, 0, 0, this.clock)).toISOString() })
  }

  async checkAccess(): Promise<void> {
    this.enter('checkAccess', 'app:/')
  }

  async stat(path: string): Promise<ResourceStat | null> {
    this.enter('stat', path)
    const file = this.files.get(path)
    if (!file) return null
    const size = typeof file.data === 'string' ? new TextEncoder().encode(file.data).length : file.data.size
    return { md5: file.md5, size, modified: file.modified }
  }

  async readText(path: string): Promise<string | null> {
    this.enter('readText', path)
    const file = this.files.get(path)
    const result = file ? await contentOf(file.data) : null
    if (this.afterRead) await this.afterRead(path)
    return result
  }

  async downloadBlob(path: string): Promise<Blob | null> {
    this.enter('downloadBlob', path)
    const file = this.files.get(path)
    if (!file) return null
    return typeof file.data === 'string' ? new Blob([file.data]) : file.data
  }

  async writeText(path: string, text: string): Promise<void> {
    this.enter('writeText', path)
    await this.put(path, text)
  }

  async uploadBlob(path: string, blob: Blob): Promise<void> {
    this.enter('uploadBlob', path)
    await this.put(path, blob)
  }

  async ensureFolder(path: string): Promise<void> {
    this.enter('ensureFolder', path)
  }

  async copy(from: string, to: string): Promise<void> {
    this.enter('copy', `${from} ${to}`)
    const file = this.files.get(from)
    if (!file) throw new YandexError('Не удалось сделать копию: файл не найден', 404)
    await this.put(to, file.data)
  }

  async remove(path: string): Promise<void> {
    this.enter('remove', path)
    this.files.delete(path)
    for (const key of [...this.files.keys()]) if (key.startsWith(`${path}/`)) this.files.delete(key)
  }

  async list(dir: string): Promise<string[]> {
    this.enter('list', dir)
    const prefix = `${dir}/`
    return [...this.files.keys()]
      .filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
      .map((key) => key.slice(prefix.length))
      .sort()
  }
}
