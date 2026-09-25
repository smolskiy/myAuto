import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

/** Цвет фона темы для <meta name="theme-color">. Совпадает с --color-bg в tokens.css и скриптом в index.html. */
export const THEME_BG: Record<ResolvedTheme, string> = { light: '#F2F3F5', dark: '#0E0F11' }

export const THEME_STORAGE_KEY = 'myauto.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

interface ThemeContextValue {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference(p: ThemePreference): void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

function writePreference(p: ThemePreference) {
  try {
    if (p === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, p)
  } catch {
    // Хранилище недоступно (приватный режим) — выбор живёт до перезагрузки.
  }
}

function darkQuery(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_QUERY)
    : null
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference)
  const [systemDark, setSystemDark] = useState<boolean>(() => darkQuery()?.matches ?? false)

  useEffect(() => {
    const mq = darkQuery()
    if (!mq) return
    const onChange = (e: { matches: boolean }) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const resolved: ResolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolved
    root.style.colorScheme = resolved
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_BG[resolved])
  }, [resolved])

  const setPreference = useCallback((p: ThemePreference) => {
    writePreference(p)
    setPreferenceState(p)
  }, [])

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  )
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme: нужен <ThemeProvider> выше по дереву')
  return ctx
}
