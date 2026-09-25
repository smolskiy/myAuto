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
      id: crypto.randomUUID(), ownerType: 'record', ownerId: 'r1', kind: 'photo', name: 'a.jpg', mime: 'image/jpeg',
      size: 1, createdAt: 1, updatedAt: 1,
    }
    await db.blobs.put({ key: `${att.id}:thumb`, attachmentId: att.id, variant: 'thumb', blob: new Blob(['x']), pending: 1, size: 1, lastAccess: 1 })
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
      id: crypto.randomUUID(), ownerType: 'record', ownerId: 'r1', kind: 'photo', name: 'a.jpg', mime: 'image/jpeg',
      size: 1, createdAt: 1, updatedAt: 1,
    }
    await db.blobs.put({ key: `${att.id}:thumb`, attachmentId: att.id, variant: 'thumb', blob: new Blob(['x']), pending: 1, size: 1, lastAccess: 1 })
    const { result, rerender } = renderHook(({ a }) => useAttachmentUrl(a, 'thumb'), { initialProps: { a: att } })
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
