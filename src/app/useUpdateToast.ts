import { useEffect } from 'react'
import { useToast } from '../ui'
import { appUpdate } from './appUpdate'

/** Минута на решение; пока палец или фокус на уведомлении — таймер стоит. Возврат в приложение напомнит снова. */
const UPDATE_TOAST_MS = 60_000

/**
 * «Доступна новая версия — Обновить»: кнопка ставит новую версию и перезагружает приложение. Версия, скачанная до
 * того, как оболочка подписалась, тоже показывается — это состояние `appUpdate`, а не разовое событие.
 */
export function useUpdateToast(): void {
  const toast = useToast()
  useEffect(() => {
    const show = () =>
      toast.show({
        text: 'Доступна новая версия',
        action: { label: 'Обновить', onClick: () => void appUpdate.apply() },
        durationMs: UPDATE_TOAST_MS,
      })
    if (appUpdate.isReady()) show()
    return appUpdate.subscribe(show)
  }, [toast])
}
