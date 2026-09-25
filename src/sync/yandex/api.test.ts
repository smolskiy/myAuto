import { describe, expect, test, vi } from 'vitest'
import { NoSpace, Offline, Unauthorized, createDiskClient } from './api'

const API = 'https://cloud-api.yandex.net/v1/disk'
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('клиент Диска', () => {
  test('авторизация заголовком OAuth и чтение файла через ссылку', async () => {
    const fetchImpl = vi.fn(async (url: string, _init?: RequestInit) =>
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

  test('сбой сети на сервере скачивания → Offline', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith(API)) return json({ href: 'https://downloader.disk.yandex.ru/x' })
      throw new TypeError('Load failed')
    })
    const disk = createDiskClient('tok', fetchImpl as unknown as typeof fetch)
    const err = await disk.readText('app:/garage.json').catch((e) => e)
    expect(err).toBeInstanceOf(Offline)
    expect(err.message).toBe('Нет связи с Яндекс.Диском')
    await expect(disk.downloadBlob('app:/attachments/x.jpg')).rejects.toBeInstanceOf(Offline)
  })

  test('сбой сети на сервере загрузки → Offline', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.startsWith(API)) return json({ href: 'https://uploader/x', method: 'PUT' })
      throw new TypeError('Load failed')
    })
    const disk = createDiskClient('tok', fetchImpl as unknown as typeof fetch)
    const err = await disk.writeText('app:/garage.json', '{}').catch((e) => e)
    expect(err).toBeInstanceOf(Offline)
    expect(err.message).toBe('Нет связи с Яндекс.Диском')
    await expect(disk.uploadBlob('app:/attachments/x.jpg', new Blob(['x']), 'image/jpeg')).rejects.toBeInstanceOf(Offline)
  })

  test('ответ с ошибкой — человеческий текст без кодов и технических деталей', async () => {
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/resources/download')) return json({ href: 'https://downloader.disk.yandex.ru/x' })
      if (url.includes('/resources/upload')) return json({ href: 'https://uploader/x', method: 'PUT' })
      if (url.startsWith(API)) return json({ error: 'InternalError', message: 'Internal server error' }, 500)
      return new Response('oops', { status: init?.method === 'PUT' ? 500 : 503 })
    })
    const disk = createDiskClient('tok', fetchImpl as unknown as typeof fetch)
    const message = (p: Promise<unknown>) => p.catch((e: Error) => e.message)
    expect(await message(disk.readText('app:/garage.json'))).toBe('Не удалось скачать файл с Диска')
    expect(await message(disk.writeText('app:/garage.json', '{}'))).toBe('Не удалось загрузить файл на Диск')
    expect(await message(disk.stat('app:/garage.json'))).toBe('Не удалось получить сведения о файле')
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
