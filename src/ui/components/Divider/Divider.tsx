import type { HTMLAttributes } from 'react'
import { cx } from '../../lib/cx'
import styles from './Divider.module.css'

export type DividerProps = HTMLAttributes<HTMLHRElement> & {
  /** Отступ слева, как у разделителя строк списка после значка. */
  inset?: boolean
}

export function Divider({ inset = false, className, ...rest }: DividerProps) {
  return <hr {...rest} className={cx(styles.divider, inset && styles.inset, className)} />
}
