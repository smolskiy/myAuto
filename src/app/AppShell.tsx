import { IconDots, IconHome, IconList, IconTool } from '@tabler/icons-react'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
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

const APP_NAME = 'Мой авто'

/** Сколько ждать заголовок ленивого экрана после перехода. */
const HEADING_WAIT_MS = 5000

/**
 * После перехода (не при первой загрузке) фокус — на `h1` нового экрана: скринридер объявляет экран,
 * а Tab идёт от начала страницы. Ленивый экран может дорисоваться позже — ждём его заголовок недолго.
 */
function useFocusHeadingOnNavigation(mainRef: RefObject<HTMLElement | null>, locationKey: string) {
  const firstKey = useRef(locationKey)
  useEffect(() => {
    const main = mainRef.current
    if (!main || locationKey === firstKey.current) return
    const focusHeading = () => {
      const h1 = main.querySelector('h1')
      if (!h1) return false
      h1.setAttribute('tabindex', '-1')
      h1.focus({ preventScroll: true })
      return true
    }
    if (focusHeading()) return
    const observer = new MutationObserver(() => {
      if (focusHeading()) observer.disconnect()
    })
    observer.observe(main, { childList: true, subtree: true })
    const timer = setTimeout(() => observer.disconnect(), HEADING_WAIT_MS)
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [mainRef, locationKey])
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
  const waiting = useFirstRunRedirect()
  const { pathname, key } = useLocation()
  const matches = useMatches()
  const routeHidesTabBar = matches.some((m) => (m.handle as RouteHandle | undefined)?.hideTabBar)
  const [openForms, setOpenForms] = useState(0)
  const [adding, setAdding] = useState(false)

  const registerForm = useCallback(() => {
    setOpenForms((n) => n + 1)
    return () => setOpenForms((n) => n - 1)
  }, [])

  const formMode = openForms > 0
  const hideTabBar = waiting || routeHidesTabBar || formMode

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

  // Заголовок вкладки/переключателя приложений — название экрана.
  const title = matches
    .map((m) => (m.handle as RouteHandle | undefined)?.title)
    .filter(Boolean)
    .at(-1)
  useEffect(() => {
    document.title = title ? `${title} — ${APP_NAME}` : APP_NAME
  }, [title])

  const mainRef = useRef<HTMLElement>(null)
  useFocusHeadingOnNavigation(mainRef, key)

  const active = activeTab(pathname)
  const items = TABS.map((t) => ({ ...t, active: t.key === active })) as [TabItem, TabItem, TabItem, TabItem]

  return (
    <div className={styles.shell}>
      <FormModeContext.Provider value={registerForm}>
        {/* Пока неизвестно, есть ли машины, — пустой экран: иначе мелькнул бы раздел перед онбордингом. */}
        <main ref={mainRef} className={styles.main}>
          {!waiting && <Outlet />}
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
