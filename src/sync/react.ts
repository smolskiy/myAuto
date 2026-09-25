import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Attachment } from '../domain/types'
import type { SyncStatus } from './contracts'
import { attachmentStore, syncEngine, yandexAuth } from './index'

/** Хуки слоя синхронизации для экранов. */

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(syncEngine.subscribe, syncEngine.getStatus)
}

export function useYandexConnected(): boolean {
  return useSyncExternalStore(yandexAuth.subscribe, yandexAuth.isConnected)
}

/**
 * object URL файла вложения: undefined — ещё грузится (или вложения нет), null — файла нет ни на устройстве,
 * ни на Диске. Адрес отзывается при размонтировании и при смене вложения.
 */
export function useAttachmentUrl(att: Attachment | undefined, variant: 'thumb' | 'orig'): string | null | undefined {
  // Живые запросы отдают новые копии той же строки: показываем прежний адрес, пока грузится новый.
  const key = att ? `${att.id}:${att.uploadedAt ?? ''}:${variant}` : null
  const [loaded, setLoaded] = useState<{ key: string; url: string | null } | null>(null)

  useEffect(() => {
    if (!att) return
    let cancelled = false
    let url: string | null = null
    const load = variant === 'thumb' ? attachmentStore.getThumbUrl(att) : attachmentStore.getOriginalUrl(att)
    load.then(
      (u) => {
        if (cancelled) {
          if (u) URL.revokeObjectURL(u)
          return
        }
        url = u
        setLoaded({ key: `${att.id}:${att.uploadedAt ?? ''}:${variant}`, url: u })
      },
      (e: unknown) => {
        console.warn('Файл вложения не открылся', e)
        if (!cancelled) setLoaded({ key: `${att.id}:${att.uploadedAt ?? ''}:${variant}`, url: null })
      },
    )
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [att, variant])

  return key !== null && loaded?.key === key ? loaded.url : undefined
}
