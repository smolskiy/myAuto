/**
 * Обновление приложения (service worker, режим «prompt»). Новая версия скачивается сама, ставится по «Обновить».
 *
 * Установленное на телефон приложение, которое сворачивают и разворачивают, не перезагружается — браузер тогда
 * не проверяет новую версию. Поэтому проверяем сами: при каждом возвращении в приложение (не чаще раза в минуту),
 * раз в час и по кнопке в настройках. Готовая версия — состояние, а не разовое событие: оболочка, подписавшаяся
 * позже, всё равно о ней узнает, а возвращение в приложение напоминает о ней снова.
 */

export type CheckResult = 'ready' | 'downloading' | 'latest' | 'offline'

const RESUME_CHECK_MS = 60_000
const HOURLY_CHECK_MS = 60 * 60_000

export function createAppUpdate() {
  let registration: ServiceWorkerRegistration | undefined
  let applyFn: (() => Promise<void>) | undefined
  let lastCheck = -Infinity
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())

  const update = async () => {
    lastCheck = Date.now()
    await registration?.update()
  }

  return {
    /** main.tsx: service worker скачал новую версию; `apply` ставит её и перезагружает приложение. */
    setReady(apply: () => Promise<void>) {
      applyFn = apply
      emit()
    },
    isReady: () => applyFn !== undefined,
    async apply() {
      await applyFn?.()
    },
    /** Слушатель зовётся, когда версия готова и когда владелец вернулся в приложение, а она всё ещё ждёт. */
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    /** Проверки при возвращении в приложение и раз в час. Возвращает отписку (для тестов). */
    watch(r: ServiceWorkerRegistration) {
      registration = r
      const onVisible = () => {
        if (document.visibilityState !== 'visible') return
        if (applyFn) emit()
        else if (Date.now() - lastCheck >= RESUME_CHECK_MS) update().catch(() => {})
      }
      document.addEventListener('visibilitychange', onVisible)
      const hourly = setInterval(() => void update().catch(() => {}), HOURLY_CHECK_MS)
      return () => {
        document.removeEventListener('visibilitychange', onVisible)
        clearInterval(hourly)
      }
    },
    /** Кнопка «Проверить обновления». */
    async check(): Promise<CheckResult> {
      if (applyFn) return 'ready'
      if (!registration) return 'latest'
      try {
        await update()
      } catch {
        return 'offline'
      }
      if (applyFn) return 'ready'
      return registration.installing || registration.waiting ? 'downloading' : 'latest'
    },
  }
}

export type AppUpdate = ReturnType<typeof createAppUpdate>

/** Одно на приложение: main.tsx его наполняет, оболочка и настройки читают. */
export const appUpdate = createAppUpdate()
