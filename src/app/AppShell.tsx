import { IconDots, IconHome, IconList, IconTool } from '@tabler/icons-react'
import { useCallback, useLayoutEffect, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useMatches } from 'react-router'
import { FORM_FOOTER_OFFSET, FormModeContext } from '../features/common/formMode'
import { BottomTabBar, type TabItem } from '../ui'
import { AddRecordSheet } from './AddRecordSheet'
import styles from './AppShell.module.css'
import type { RouteHandle } from './routes'
import { useFirstRunRedirect } from './useFirstRunRedirect'

type TabKey = 'home' | 'journal' | 'reminders' | 'more'

/** Какой раздел нижней панели подсвечен: запись — из журнала, история узла — из ТО, остальное — из «Ещё». */
function activeTab(pathname: string): TabKey | null {
  if (pathname === '/') return 'home'
  if (/^\/(journal|record)(\/|$)/.test(pathname)) return 'journal'
  if (/^\/(reminders|items)(\/|$)/.test(pathname)) return 'reminders'
  if (/^\/(more|stats|garage|vehicle|documents|tires|places|masters|catalog|settings)(\/|$)/.test(pathname))
    return 'more'
  return null
}

const TABS: { key: TabKey; label: string; icon: ReactNode; href: string }[] = [
  { key: 'home', label: 'Главная', icon: <IconHome />, href: '/' },
  { key: 'journal', label: 'Журнал', icon: <IconList />, href: '/journal' },
  { key: 'reminders', label: 'ТО', icon: <IconTool />, href: '/reminders' },
  { key: 'more', label: 'Ещё', icon: <IconDots />, href: '/more' },
]

/**
 * Оболочка: экран маршрута и нижняя панель с «+». Панели нет на маршрутах с `hideTabBar` и под любой
 * открытой FormPage (она регистрируется через FormModeContext). Отступ уведомлений ставит только оболочка.
 */
export default function AppShell() {
  useFirstRunRedirect()
  const { pathname } = useLocation()
  const matches = useMatches()
  const routeHidesTabBar = matches.some((m) => (m.handle as RouteHandle | undefined)?.hideTabBar)
  const [openForms, setOpenForms] = useState(0)
  const [adding, setAdding] = useState(false)

  const registerForm = useCallback(() => {
    setOpenForms((n) => n + 1)
    return () => setOpenForms((n) => n - 1)
  }, [])

  const formMode = openForms > 0
  const hideTabBar = routeHidesTabBar || formMode

  // Регион уведомлений живёт вне этого дерева (в ToastProvider), поэтому переменная — на <html>:
  // над панелью (значение по умолчанию), над кнопкой «Сохранить» формы или у нижнего края.
  const toastOffset = formMode ? FORM_FOOTER_OFFSET : hideTabBar ? '0px' : null
  useLayoutEffect(() => {
    const root = document.documentElement.style
    if (toastOffset) root.setProperty('--toast-offset', toastOffset)
    return () => {
      root.removeProperty('--toast-offset')
    }
  }, [toastOffset])

  const active = activeTab(pathname)
  const items = TABS.map((t) => ({ ...t, active: t.key === active })) as [TabItem, TabItem, TabItem, TabItem]

  return (
    <div className={styles.shell}>
      <FormModeContext.Provider value={registerForm}>
        <main className={styles.main}>
          <Outlet />
        </main>
      </FormModeContext.Provider>
      {!hideTabBar && (
        <>
          <BottomTabBar
            items={items}
            onAdd={() => setAdding(true)}
            renderLink={(item, children) => (
              <Link to={item.href} aria-current={item.active ? 'page' : undefined}>
                {children}
              </Link>
            )}
          />
          <AddRecordSheet open={adding} onClose={() => setAdding(false)} />
        </>
      )}
    </div>
  )
}
