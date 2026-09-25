import styles from './MonthHeader.module.css'

export interface MonthHeaderProps {
  /** «Сентябрь 2026» */
  title: string
  /** Итог месяца «48 200 ₽». */
  total?: string
}

/** Липкий заголовок месяца в ленте журнала: прилипает под шапкой экрана. */
export function MonthHeader({ title, total }: MonthHeaderProps) {
  return (
    <div className={styles.header}>
      <h2 className={styles.title}>{title}</h2>
      {total && <span className={styles.total}>{total}</span>}
    </div>
  )
}
