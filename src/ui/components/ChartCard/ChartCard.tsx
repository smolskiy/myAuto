import { useId, type ReactNode } from 'react'
import styles from './ChartCard.module.css'

export interface ChartCardProps {
  title: string
  subtitle?: string
  /** График (Recharts с цветами из chartTheme.readFromCss()). */
  children: ReactNode
  /** Таблица точных чисел под графиком — её же читает скринридер. */
  table?: ReactNode
  /** Управление над графиком (выбор вида): доступно скринридеру, в отличие от самого графика. */
  action?: ReactNode
}

export function ChartCard({ title, subtitle, children, table, action }: ChartCardProps) {
  const id = useId()
  return (
    <section className={styles.card} aria-labelledby={id}>
      <div className={styles.header}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {action}
      <div className={styles.chart} aria-hidden={table ? true : undefined}>
        {children}
      </div>
      {table && <div className={styles.table}>{table}</div>}
    </section>
  )
}
