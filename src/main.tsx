import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './ui/base.css'
import { ThemeProvider } from './ui'
import { initApp } from './app/init'
import { AppProviders } from './app/providers'
import AppRouter from './app/router'
import { NEED_REFRESH_EVENT, type NeedRefreshDetail } from './app/useUpdateToast'

const updateSW = registerSW({
  onNeedRefresh() {
    // Оболочка показывает «Доступна новая версия — Обновить» по этому событию (app/useUpdateToast.ts).
    const detail: NeedRefreshDetail = { update: () => updateSW(true) }
    window.dispatchEvent(new CustomEvent(NEED_REFRESH_EVENT, { detail }))
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
