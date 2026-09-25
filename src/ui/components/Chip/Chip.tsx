import { IconX } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import styles from './Chip.module.css'

export interface ChipProps {
  children: ReactNode
  /** Задан — чип становится переключателем (aria-pressed). */
  selected?: boolean
  onClick?(): void
  /** Показывает крестик «Убрать фильтр «…»». */
  onRemove?(): void
  icon?: ReactNode
  count?: number
}

export function Chip({ children, selected, onClick, onRemove, icon, count }: ChipProps) {
  const interactive = onClick !== undefined || selected !== undefined
  const content = (
    <>
      {icon && (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={styles.label}>{children}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </>
  )
  const name = typeof children === 'string' ? children : ''
  return (
    <span className={cx(styles.chip, selected && styles.selected, onRemove && styles.removable)}>
      {interactive ? (
        <button type="button" className={styles.main} aria-pressed={selected} onClick={onClick}>
          {content}
        </button>
      ) : (
        <span className={styles.main}>{content}</span>
      )}
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          aria-label={name ? `Убрать фильтр «${name}»` : 'Убрать фильтр'}
          onClick={onRemove}
        >
          <IconX size={16} stroke={2.25} aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
