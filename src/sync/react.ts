import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
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

/** Текст последней неудачи входа в Яндекс или null. */
export function useLoginError(): string | null {
  return useSyncExternalStore(yandexAuth.subscribe, yandexAuth.getLoginError)
}

/**
 * object URL файла вложения: undefined — ещё грузится (или вложения нет), null — файла нет ни на устройстве,
 * ни на Диске.
 *
 * Живые запросы отдают новые копии той же строки, поэтому адрес пересоздаётся только при смене id, вида,
 * `uploadedAt` или варианта. Пока грузится замена, отдаётся прежний адрес того же файла; отзывается он
 * только после того, как замена показана, а последний — при размонтировании.
 */
export function useAttachmentUrl(att: Attachment | undefined, variant: 'thumb' | 'orig'): string | null | undefined {
  const attRef = useRef(att)
  useEffect(() => {
    attRef.current = att
  })
  const id = att?.id
  const uploadedAt = att?.uploadedAt
  const kind = att?.kind
  const [loaded, setLoaded] = useState<{ file: string; url: string | null } | null>(null)

  useEffect(() => {
    const current = attRef.current
    if (!id || !current) return
    let cancelled = false
    const file = `${id}:${variant}`
    const load = variant === 'thumb' ? attachmentStore.getThumbUrl(current) : attachmentStore.getOriginalUrl(current)
    load.then(
      (url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url)
          return
        }
        setLoaded({ file, url })
      },
      (e: unknown) => {
        console.warn('Файл вложения не открылся', e)
        if (!cancelled) setLoaded({ file, url: null })
      },
    )
    return () => {
      cancelled = true
    }
  }, [id, uploadedAt, kind, variant])

  // Отзыв — после того как показан следующий адрес (очистка эффекта предыдущего значения) или при размонтировании.
  useEffect(() => {
    const url = loaded?.url
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [loaded])

  return id && loaded?.file === `${id}:${variant}` ? loaded.url : undefined
}
