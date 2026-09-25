import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './ui/base.css'
import { ThemeProvider } from './ui'
import { initApp } from './app/init'
import { AppProviders } from './app/providers'
import AppRouter from './app/router'
import { appUpdate } from './app/appUpdate'

const updateSW = registerSW({
  onNeedRefresh() {
    // Оболочка показывает «Доступна новая версия — Обновить» (app/useUpdateToast.ts), настройки — строку «Обновить».
    appUpdate.setReady(() => updateSW(true))
  },
  onRegisteredSW(_url, registration) {
    if (registration) appUpdate.watch(registration)
  },
})

// Сид каталога и синхронизация идут фоном: экраны их не ждут (хуки сами подмешивают встроенный каталог).
initApp().catch((e: unknown) => console.error('Запуск приложения не завершился', e))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </ThemeProvider>
  </StrictMode>,
)
