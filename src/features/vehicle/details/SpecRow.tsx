import type { ReactNode } from 'react'
import styles from './details.module.css'

export interface SpecRowProps {
  label: string
  children: ReactNode
  /** Моноширинное значение (VIN, номер документа). */
  mono?: boolean
}

/**
 * Строка «название — значение» внутри ListGroup. В отличие от ListItem значение не обрезается,
 * а переносится: двигатель, спецификация масла и сумма с датой должны читаться целиком.
 */
export function SpecRow({ label, children, mono }: SpecRowProps) {
  return (
    <div className={styles.spec}>
      <span className={styles.specLabel}>{label}</span>
      <span className={mono ? `${styles.specValue} ${styles.mono}` : styles.specValue}>{children}</span>
    </div>
  )
}
