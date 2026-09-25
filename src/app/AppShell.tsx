import { IconDots, IconHome, IconList, IconTool } from '@tabler/icons-react'
import { useLayoutEffect, useState, type ReactNode } from 'react'
import { Link, Outlet, useLocation, useMatches } from 'react-router'
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

/** Оболочка: экран маршрута и нижняя панель с «+»; на формах панели нет. */
export default function AppShell() {
  useFirstRunRedirect()
  const { pathname } = useLocation()
  const matches = useMatches()
  const hideTabBar = matches.some((m) => (m.handle as RouteHandle | undefined)?.hideTabBar)
  const [adding, setAdding] = useState(false)

  // Уведомления стоят над панелью; без панели — у нижнего края (регион тоста живёт вне этого дерева).
  useLayoutEffect(() => {
    const root = document.documentElement.style
    if (hideTabBar) root.setProperty('--toast-offset', '0px')
    else root.removeProperty('--toast-offset')
  }, [hideTabBar])

  const active = activeTab(pathname)
  const items = TABS.map((t) => ({ ...t, active: t.key === active })) as [TabItem, TabItem, TabItem, TabItem]

  return (
    <div className={styles.shell}>
      <main className={styles.main}>
        <Outlet />
      </main>
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
