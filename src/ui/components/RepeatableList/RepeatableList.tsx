import { IconPlus } from '@tabler/icons-react'
import { Children, isValidElement, useId, type ReactNode } from 'react'
import styles from './RepeatableList.module.css'

export interface RepeatableListProps {
  /** «Работы», «Запчасти». */
  title: string
  /** «Добавить запчасть». */
  addLabel: string
  onAdd(): void
  /** Строки — обычно LineItemRow. */
  children: ReactNode
  emptyText?: string
  /** Итог строк «4 350 ₽». */
  total?: string
}

/** Каркас повторяемых строк формы: заголовок с итогом, строки, кнопка «Добавить…» снизу. */
export function RepeatableList({ title, addLabel, onAdd, children, emptyText, total }: RepeatableListProps) {
  const id = useId()
  const rows = Children.toArray(children)
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.header}>
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {total && <span className={styles.total}>{total}</span>}
      </div>
      <div className={styles.card}>
        {rows.length > 0 ? (
          <ul className={styles.rows}>
            {rows.map((row, i) => (
              // Ключ строки — ключ ребёнка: удаление строки не сбрасывает состояние соседних.
              <li key={isValidElement(row) ? (row.key ?? i) : i} className={styles.row}>
                {row}
              </li>
            ))}
          </ul>
        ) : (
          emptyText && <p className={styles.empty}>{emptyText}</p>
        )}
        <button type="button" className={styles.add} onClick={onAdd}>
          <IconPlus size={20} stroke={2} aria-hidden="true" />
          {addLabel}
        </button>
      </div>
    </section>
  )
}
