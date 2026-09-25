import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import styles from './Toast.module.css'

export interface ToastOptions {
  text: string
  action?: { label: string; onClick(): void }
  /** По умолчанию 5000. */
  durationMs?: number
}

export interface ToastApi {
  show(t: ToastOptions): void
}

const ToastContext = createContext<ToastApi | null>(null)

interface Current extends ToastOptions {
  id: number
}

/**
 * Одно уведомление внизу экрана над панелью вкладок; новое заменяет старое.
 * Пока палец/курсор/фокус на уведомлении — таймер стоит (WCAG 2.2.1).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Current | null>(null)
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const dismiss = useCallback(() => {
    clearTimeout(timer.current)
    setToast(null)
  }, [])

  const arm = useCallback(
    (ms: number) => {
      clearTimeout(timer.current)
      timer.current = setTimeout(dismiss, ms)
    },
    [dismiss],
  )

  const show = useCallback((t: ToastOptions) => {
    seq.current += 1
    setToast({ ...t, id: seq.current })
  }, [])

  useEffect(() => {
    if (toast) arm(toast.durationMs ?? 5000)
    return () => clearTimeout(timer.current)
  }, [toast, arm])

  const api = useMemo(() => ({ show }), [show])
  const duration = toast?.durationMs ?? 5000

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {toast && (
          <div
            key={toast.id}
            className={styles.toast}
            onPointerEnter={() => clearTimeout(timer.current)}
            onPointerLeave={() => arm(duration)}
            onFocus={() => clearTimeout(timer.current)}
            onBlur={() => arm(duration)}
          >
            <span className={styles.text}>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  toast.action?.onClick()
                  dismiss()
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast: нужен <ToastProvider> выше по дереву')
  return ctx
}
