import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './ui/base.css'
import { ThemeProvider } from './ui'
import AppRouter from './app/router'

const updateSW = registerSW({
  onNeedRefresh() {
    // Оболочка (волна 2) показывает «Доступна новая версия — Обновить» по этому событию.
    window.dispatchEvent(new CustomEvent('pwa:need-refresh', { detail: { update: () => updateSW(true) } }))
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  </StrictMode>,
)
