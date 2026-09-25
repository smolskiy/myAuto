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
 * Разметка — пара термин/определение: скринридер читает их раздельно, а не слитно «Двигатель1,4 л».
 */
export function SpecRow({ label, children, mono }: SpecRowProps) {
  return (
    <dl className={styles.spec}>
      <dt className={styles.specLabel}>{label}</dt>
      <dd className={mono ? `${styles.specValue} ${styles.mono}` : styles.specValue}>{children}</dd>
    </dl>
  )
}
