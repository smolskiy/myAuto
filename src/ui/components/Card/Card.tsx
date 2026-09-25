import type { HTMLAttributes } from 'react'
import { cx } from '../../lib/cx'
import styles from './Card.module.css'

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Внутренний отступ 16 px. Без него — для карточек со строками во всю ширину. */
  padded?: boolean
}

export function Card({ padded = false, className, ...rest }: CardProps) {
  return <div {...rest} className={cx(styles.card, padded && styles.padded, className)} />
}
