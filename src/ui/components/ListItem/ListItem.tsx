import { IconChevronRight } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import shared from '../../shared.module.css'
import styles from './ListItem.module.css'

export interface ListItemProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Значок слева (обычно `<Icon circle />`). */
  leading?: ReactNode
  /** Элемент справа: Switch, Badge, StatusPill. Не сочетать с onClick/href — вложенные кнопки недопустимы. */
  trailing?: ReactNode
  /** Значение справа («148 320 км»), tabular-nums. */
  value?: ReactNode
  chevron?: boolean
  onClick?(): void
  href?: string
  /** Ссылка наружу (карты, сайт) — в новой вкладке, приложение остаётся открытым. */
  external?: boolean
  /** Разрушительное действие («Удалить машину») — заголовок красным. */
  danger?: boolean
}

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
  value,
  chevron,
  onClick,
  href,
  external,
  danger,
}: ListItemProps) {
  const body = (
    <>
      {leading && (
        <span className={styles.leading} data-leading="">
          {leading}
        </span>
      )}
      <span className={styles.text}>
        <span className={cx(styles.title, shared.truncate)}>{title}</span>
        {subtitle && <span className={cx(styles.subtitle, shared.truncate)}>{subtitle}</span>}
      </span>
      {value != null && <span className={styles.value}>{value}</span>}
      {trailing && <span className={styles.trailing}>{trailing}</span>}
      {chevron && <IconChevronRight className={styles.chevron} size={20} stroke={2} aria-hidden="true" />}
    </>
  )
  const cls = cx(styles.item, danger && styles.danger, (href || onClick) && styles.interactive)
  if (href) {
    return (
      <a
        className={cls}
        href={href}
        onClick={onClick}
        {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      >
        {body}
      </a>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {body}
      </button>
    )
  }
  return <div className={cls}>{body}</div>
}
