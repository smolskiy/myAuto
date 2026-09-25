import { IconPlus } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import styles from './BottomTabBar.module.css'

export interface TabItem {
  key: string
  label: string
  icon: ReactNode
  href: string
  active: boolean
}

export interface BottomTabBarProps {
  /** Главная, Журнал, ТО, Ещё — кнопка «+» встаёт посередине. */
  items: [TabItem, TabItem, TabItem, TabItem]
  onAdd(): void
  /** По умолчанию «Добавить запись». */
  addLabel?: string
  /**
   * Своя ссылка роутера вместо <a>. Должна отрендерить <a href> с `children` внутри и
   * `aria-current="page"` у активной вкладки (NavLink из react-router делает это сам).
   */
  renderLink?(item: TabItem, children: ReactNode): ReactNode
}

/** Нижняя панель: две вкладки, «+» по центру, две вкладки. Учитывает нижнюю безопасную зону. */
export function BottomTabBar({ items, onAdd, addLabel = 'Добавить запись', renderLink }: BottomTabBarProps) {
  const tab = (item: TabItem) => {
    const content = (
      <>
        <span className={styles.icon} aria-hidden="true">
          {item.icon}
        </span>
        <span className={styles.label}>{item.label}</span>
      </>
    )
    return (
      <li key={item.key} className={styles.tab} data-active={item.active || undefined}>
        {renderLink ? (
          renderLink(item, content)
        ) : (
          <a href={item.href} aria-current={item.active ? 'page' : undefined}>
            {content}
          </a>
        )}
      </li>
    )
  }
  const [a, b, c, d] = items
  return (
    <nav className={styles.bar} aria-label="Основная навигация">
      <ul className={styles.list}>
        {tab(a)}
        {tab(b)}
        <li className={styles.addSlot}>
          <button type="button" className={styles.add} aria-label={addLabel} title={addLabel} onClick={onAdd}>
            <IconPlus size={28} stroke={2.25} aria-hidden="true" />
          </button>
        </li>
        {tab(c)}
        {tab(d)}
      </ul>
    </nav>
  )
}
