import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib/cx'
import styles from './IconButton.module.css'

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Доступное имя (aria-label) и подсказка при наведении. */
  label: string
  icon: ReactNode
  variant?: 'ghost' | 'filled'
}

export function IconButton({ label, icon, variant = 'ghost', type = 'button', className, ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={rest.title ?? label}
      className={cx(styles.button, styles[variant], className)}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
    </button>
  )
}
