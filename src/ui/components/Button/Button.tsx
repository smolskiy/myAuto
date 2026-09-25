import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react'
import { cx } from '../../lib/cx'
import { Spinner } from '../Spinner/Spinner'
import styles from './Button.module.css'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
  icon?: ReactNode
  /** Занято: кнопка остаётся в фокусе, но не нажимается и объявляет aria-busy. */
  loading?: boolean
  /** На всю ширину контейнера. */
  block?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  block = false,
  type = 'button',
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      e.preventDefault()
      return
    }
    onClick?.(e)
  }
  return (
    <button
      {...rest}
      type={type}
      className={cx(styles.button, styles[variant], styles[size], block && styles.block, className)}
      aria-busy={loading || undefined}
      aria-disabled={loading || rest['aria-disabled'] || undefined}
      onClick={handleClick}
    >
      {loading ? (
        <span className={styles.icon}>
          <Spinner size={size === 'sm' ? 16 : 24} />
        </span>
      ) : icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children != null && <span className={styles.label}>{children}</span>}
    </button>
  )
}
