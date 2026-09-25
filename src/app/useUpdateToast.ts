import { useEffect } from 'react'
import { useToast } from '../ui'

/** Событие из main.tsx: service worker скачал новую версию и ждёт команды. */
export const NEED_REFRESH_EVENT = 'pwa:need-refresh'

export interface NeedRefreshDetail {
  update(): void | Promise<void>
}

/** Минута на решение; пока палец или фокус на уведомлении — таймер стоит. Без ответа версия встанет при следующем запуске. */
const UPDATE_TOAST_MS = 60_000

/** «Доступна новая версия — Обновить»: кнопка активирует новый service worker и перезагружает приложение. */
export function useUpdateToast(): void {
  const toast = useToast()
  useEffect(() => {
    const onNeedRefresh = (e: Event) => {
      const { update } = (e as CustomEvent<NeedRefreshDetail>).detail
      toast.show({
        text: 'Доступна новая версия',
        action: { label: 'Обновить', onClick: () => void update() },
        durationMs: UPDATE_TOAST_MS,
      })
    }
    window.addEventListener(NEED_REFRESH_EVENT, onNeedRefresh)
    return () => window.removeEventListener(NEED_REFRESH_EVENT, onNeedRefresh)
  }, [toast])
}
