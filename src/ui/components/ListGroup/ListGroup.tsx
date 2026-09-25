import { Children, isValidElement, useId, type ReactNode } from 'react'
import styles from './ListGroup.module.css'

export interface ListGroupProps {
  title?: string
  footer?: string
  children: ReactNode
  /** Уровень заголовка группы в структуре экрана. По умолчанию 2. */
  titleLevel?: 2 | 3 | 4
}

/** Белая карточка-группа строк с заголовком сверху и пояснением снизу, как в системных настройках. */
export function ListGroup({ title, footer, children, titleLevel = 2 }: ListGroupProps) {
  const id = useId()
  const Heading = `h${titleLevel}` as const
  const rows = Children.toArray(children)
  return (
    <div className={styles.group}>
      {title && (
        <Heading id={id} className={styles.title}>
          {title}
        </Heading>
      )}
      <ul className={styles.list} aria-labelledby={title ? id : undefined}>
        {rows.map((row, i) => (
          <li key={isValidElement(row) ? (row.key ?? i) : i} className={styles.row}>
            {row}
          </li>
        ))}
      </ul>
      {footer && <p className={styles.footer}>{footer}</p>}
    </div>
  )
}
