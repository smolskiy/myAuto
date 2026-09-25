import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { db } from '../db/instance'
import type { Attachment } from '../domain/types'
import { initSync, syncEngine, yandexAuth } from './index'
import { useAttachmentUrl, useLoginError, useSyncStatus } from './react'

test('без подключения статус off, повторный initSync безопасен', async () => {
  await initSync()
  await initSync()
  await syncEngine.syncNow()
  const { result } = renderHook(() => useSyncStatus())
  expect(result.current.state).toBe('off')
  syncEngine.stop()
})

test('useLoginError показывает ошибку входа, новый вход её сбрасывает', async () => {
  const { result } = renderHook(() => useLoginError())
  expect(result.current).toBeNull()
  await act(async () => {
    await yandexAuth.connectWithCode('   ').catch(() => {})
  })
  expect(result.current).toBe('Вставьте код из Яндекса')
  act(() => {
    yandexAuth.setClientId('cid')
    yandexAuth.loginUrl()
  })
  expect(result.current).toBeNull()
})

test('вход сразу запускает синхронизацию, выход сразу переводит статус в off', async () => {
  const API = 'https://cloud-api.yandex.net/v1/disk'
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/resources/upload'))
        return new Response(JSON.stringify({ href: 'https://uploader/x', method: 'PUT' }))
      if (url === 'https://uploader/x') return new Response(null, { status: 201 })
      if (url.startsWith(API) && (init?.method === 'PUT' || url.includes('/resources/copy')))
        return new Response(null, { status: 201 })
      return new Response('{}', { status: 404 })
    }),
  )
  try {
    await yandexAuth.connectWithToken('y0_T')
    await waitFor(() => expect(syncEngine.getStatus().state).toBe('idle'))
    await yandexAuth.disconnect()
    await waitFor(() => expect(syncEngine.getStatus().state).toBe('off'))
  } finally {
    vi.unstubAllGlobals()
  }
})

test('неудачный initSync не запоминается — следующий вызов пробует снова', async () => {
  vi.resetModules()
  const fresh = await import('./index')
  const init = vi.spyOn(fresh.yandexAuth, 'init').mockRejectedValueOnce(new Error('IndexedDB недоступна'))
  await expect(fresh.initSync()).rejects.toThrow('IndexedDB недоступна')
  await fresh.initSync()
  expect(init).toHaveBeenCalledTimes(2)
  fresh.syncEngine.stop()
})

test('вход в другой вкладке (канал «myauto-auth») — эта перечитывает токен', async () => {
  const channels: { name: string; onmessage: ((e: { data: unknown }) => void) | null }[] = []
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      onmessage: ((e: { data: unknown }) => void) | null = null
      constructor(readonly name: string) {
        channels.push(this)
      }
      postMessage() {}
    },
  )
  try {
    vi.resetModules()
    const fresh = await import('./index')
    const { db: freshDb } = await import('../db/instance')
    const { META_KEYS, setMeta } = await import('../db/meta')
    expect(channels.map((c) => c.name)).toEqual(['myauto-auth'])
    expect(fresh.yandexAuth.isConnected()).toBe(false)
    // Другая вкладка вошла: токен уже в общей базе, сюда пришло сообщение.
    await setMeta(freshDb, META_KEYS.yandexToken, 'y0_OTHER_TAB')
    channels[0]!.onmessage?.({ data: 'auth-changed' })
    await waitFor(() => expect(fresh.yandexAuth.isConnected()).toBe(true))
    await fresh.yandexAuth.disconnect()
    fresh.syncEngine.stop()
  } finally {
    vi.unstubAllGlobals()
  }
})

describe('постоянное хранилище', () => {
  const original = Object.getOwnPropertyDescriptor(navigator, 'storage')
  afterEach(() => {
    if (original) Object.defineProperty(navigator, 'storage', original)
    else delete (navigator as { storage?: unknown }).storage
  })
  const withinSecond = <T>(p: Promise<T>) =>
    Promise.race([p.then(() => 'готово'), new Promise((r) => setTimeout(() => r('ждёт'), 1000))])

  test('initSync не ждёт ответа navigator.storage.persist() (браузер может держать запрос долго)', async () => {
    vi.resetModules()
    const fresh = await import('./index')
    const persist = vi.fn(() => new Promise<boolean>(() => {}))
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { persist } })
    expect(await withinSecond(fresh.initSync())).toBe('готово')
    expect(persist).toHaveBeenCalledOnce()
    fresh.syncEngine.stop()
  })

  test('отказ persist() — только предупреждение, запуск идёт дальше', async () => {
    vi.resetModules()
    const fresh = await import('./index')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const persist = vi.fn(() => Promise.reject(new Error('нет')))
    Object.defineProperty(navigator, 'storage', { configurable: true, value: { persist } })
    expect(await withinSecond(fresh.initSync())).toBe('готово')
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith('Постоянное хранилище не выдано', expect.any(Error)),
    )
    fresh.syncEngine.stop()
  })
})

describe('адреса вложений', () => {
  const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }
  afterEach(() => {
    URL.createObjectURL = original.create
    URL.revokeObjectURL = original.revoke
  })

  test('useAttachmentUrl отдаёт адрес превью и отзывает его при размонтировании', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:thumb')
    URL.revokeObjectURL = vi.fn()
    const att: Attachment = {
      id: crypto.randomUUID(),
      ownerType: 'record',
      ownerId: 'r1',
      kind: 'photo',
      name: 'a.jpg',
      mime: 'image/jpeg',
      size: 1,
      createdAt: 1,
      updatedAt: 1,
    }
    await db.blobs.put({
      key: `${att.id}:thumb`,
      attachmentId: att.id,
      variant: 'thumb',
      blob: new Blob(['x']),
      pending: 1,
      size: 1,
      lastAccess: 1,
    })
    const { result, unmount } = renderHook(() => useAttachmentUrl(att, 'thumb'))
    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toBe('blob:thumb'))
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:thumb')
    expect(renderHook(() => useAttachmentUrl(undefined, 'thumb')).result.current).toBeUndefined()
  })

  test('свежая копия того же вложения не пересоздаёт адрес; старый отзывается только после замены', async () => {
    let n = 0
    URL.createObjectURL = vi.fn(() => `blob:${++n}`)
    URL.revokeObjectURL = vi.fn()
    const att: Attachment = {
      id: crypto.randomUUID(),
      ownerType: 'record',
      ownerId: 'r1',
      kind: 'photo',
      name: 'a.jpg',
      mime: 'image/jpeg',
      size: 1,
      createdAt: 1,
      updatedAt: 1,
    }
    await db.blobs.put({
      key: `${att.id}:thumb`,
      attachmentId: att.id,
      variant: 'thumb',
      blob: new Blob(['x']),
      pending: 1,
      size: 1,
      lastAccess: 1,
    })
    const { result, rerender } = renderHook(({ a }) => useAttachmentUrl(a, 'thumb'), {
      initialProps: { a: att },
    })
    await waitFor(() => expect(result.current).toBe('blob:1'))

    rerender({ a: { ...att } }) // живой запрос отдал новую копию той же строки
    await new Promise((r) => setTimeout(r, 30))
    expect(result.current).toBe('blob:1')
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    rerender({ a: { ...att, uploadedAt: 5 } }) // файл лёг на Диск — адрес пересоздаётся
    expect(result.current).toBe('blob:1') // пока грузится новый, старый ещё не отозван
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current).toBe('blob:2'))
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1'))
  })
})
