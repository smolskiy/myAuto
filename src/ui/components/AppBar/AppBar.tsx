import { IconChevronLeft } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { IconButton } from '../IconButton/IconButton'
import styles from './AppBar.module.css'

export interface AppBarProps {
  /** Заголовок экрана — единственный <h1> на экране. */
  title: string
  onBack?(): void
  /** Кнопки справа (IconButton, SyncStatusBadge). */
  actions?: ReactNode
  /** Крупный заголовок под полосой — для корневых экранов (Главная, Журнал, ТО, Ещё). */
  large?: boolean
}

/** Липкая шапка экрана с учётом выреза сверху (--safe-top). Крупный заголовок уезжает с содержимым. */
export function AppBar({ title, onBack, actions, large }: AppBarProps) {
  return (
    <>
      <header className={styles.appbar}>
        <div className={styles.bar}>
          {onBack && (
            <span className={styles.back}>
              <IconButton label="Назад" icon={<IconChevronLeft />} onClick={onBack} />
            </span>
          )}
          {large ? <span className={styles.spacer} /> : <h1 className={styles.title}>{title}</h1>}
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      </header>
      {large && <h1 className={styles.largeTitle}>{title}</h1>}
    </>
  )
}
