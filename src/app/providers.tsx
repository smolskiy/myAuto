import type { ReactNode } from 'react'
import { ToastProvider } from '../ui'
import { useUpdateToast } from './useUpdateToast'

function UpdateToast() {
  useUpdateToast()
  return null
}

/** Общие провайдеры приложения (ThemeProvider — в main.tsx). Слушатель новой версии живёт здесь, вне маршрутов. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <UpdateToast />
      {children}
    </ToastProvider>
  )
}
