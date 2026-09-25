import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './ui/base.css'
import { ThemeProvider } from './ui'
import { initApp } from './app/init'
import AppRouter from './app/router'

const updateSW = registerSW({
  onNeedRefresh() {
    // Оболочка показывает «Доступна новая версия — Обновить» по этому событию (app/useUpdateToast.ts).
    window.dispatchEvent(new CustomEvent('pwa:need-refresh', { detail: { update: () => updateSW(true) } }))
  },
})

// Сид каталога и синхронизация идут фоном: экраны их не ждут (хуки сами подмешивают встроенный каталог).
initApp().catch((e: unknown) => console.error('Запуск приложения не завершился', e))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  </StrictMode>,
)
