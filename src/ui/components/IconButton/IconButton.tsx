import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cx } from '../../lib/cx'
import styles from './IconButton.module.css'

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Доступное имя (aria-label) и подсказка при наведении. */
  label: string
  icon: ReactNode
  variant?: 'ghost' | 'filled'
  /** sm — видимо 32 px (область касания всё равно 44 px). */
  size?: 'md' | 'sm'
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  type = 'button',
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      title={rest.title ?? label}
      className={cx(styles.button, styles[variant], styles[size], className)}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
    </button>
  )
}
