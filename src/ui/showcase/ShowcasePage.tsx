import { useState } from 'react'
import { PortalTargetProvider } from '../components/Overlay/Overlay'
import { SegmentedControl, ToastProvider } from '../index'
import { cx } from '../lib/cx'
import { BasicsSection } from './sections/BasicsSection'
import { ChartsSection } from './sections/ChartsSection'
import { FieldsSection } from './sections/FieldsSection'
import { ListsSection } from './sections/ListsSection'
import { OverlaysSection } from './sections/OverlaysSection'
import { RichSection } from './sections/RichSection'
import { ScreensSection } from './sections/ScreensSection'
import { TokensSection } from './sections/TokensSection'
import styles from './Showcase.module.css'

type Theme = 'light' | 'dark'
type Mode = 'single' | 'both'

const THEME_NAME: Record<Theme, string> = { light: 'Светлая тема', dark: 'Тёмная тема' }

function initialTheme(): Theme {
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'
    ? 'dark'
    : 'light'
}

/** Все разделы витрины в одной теме. Шторки и уведомления рисуются внутри колонки — в её теме. */
function ThemeColumn({ theme, framed }: { theme: Theme; framed: boolean }) {
  const [el, setEl] = useState<HTMLElement | null>(null)
  return (
    <section
      ref={setEl}
      className={styles.column}
      data-theme={framed ? theme : undefined}
      aria-label={THEME_NAME[theme]}
    >
      {framed && <p className={styles.columnLabel}>{THEME_NAME[theme]}</p>}
      <PortalTargetProvider value={el}>
        <ToastProvider>
          <TokensSection theme={theme} />
          <BasicsSection />
          <ListsSection />
          <FieldsSection />
          <OverlaysSection />
          <RichSection />
          <ChartsSection theme={theme} />
          <ScreensSection />
        </ToastProvider>
      </PortalTargetProvider>
    </section>
  )
}

/** Витрина дизайн-системы: каждый компонент во всех состояниях, одна тема или обе рядом. */
export default function ShowcasePage() {
  const [mode, setMode] = useState<Mode>('single')
  const [theme, setTheme] = useState<Theme>(initialTheme)

  return (
    <div className={styles.page} data-theme={mode === 'single' ? theme : undefined}>
      <header className={styles.header}>
        <h1 className={styles.title}>Витрина компонентов</h1>
        <p className={styles.intro}>
          Дизайн-система «Мой авто»: токены, базовые элементы, списки, поля, оверлеи и эскизы экранов на
          выдуманных данных.
        </p>
        <div className={styles.controls}>
          <SegmentedControl
            ariaLabel="Режим витрины"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'single', label: 'Одна тема' },
              { value: 'both', label: 'Обе рядом' },
            ]}
          />
          {mode === 'single' && (
            <SegmentedControl
              ariaLabel="Тема витрины"
              value={theme}
              onChange={setTheme}
              options={[
                { value: 'light', label: 'Светлая' },
                { value: 'dark', label: 'Тёмная' },
              ]}
            />
          )}
        </div>
      </header>
      <div className={cx(styles.columns, mode === 'single' ? styles.single : styles.both)}>
        {mode === 'single' ? (
          <ThemeColumn key={theme} theme={theme} framed={false} />
        ) : (
          <>
            <ThemeColumn theme="light" framed />
            <ThemeColumn theme="dark" framed />
          </>
        )}
      </div>
    </div>
  )
}
