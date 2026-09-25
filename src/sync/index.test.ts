import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { db } from '../db/instance'
import type { Attachment } from '../domain/types'
import { initSync, syncEngine } from './index'
import { useAttachmentUrl, useSyncStatus } from './react'

test('без подключения статус off, повторный initSync безопасен', async () => {
  await initSync()
  await initSync()
  await syncEngine.syncNow()
  const { result } = renderHook(() => useSyncStatus())
  expect(result.current.state).toBe('off')
  syncEngine.stop()
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
})
