import { IconHistory, IconTrash } from '@tabler/icons-react'
import { cx } from '../../lib/cx'
import shared from '../../shared.module.css'
import styles from './LineItemRow.module.css'

export interface LineItemRowProps {
  title: string
  /** «Mann-Filter · W 712/95 · 1 шт» */
  meta?: string
  amount?: string
  onEdit(): void
  onRemove(): void
  /** «В прошлый раз: Mann W 712/95, 650 ₽» — одно нажатие заполняет строку. */
  suggestion?: { text: string; onApply(): void }
}

/** Строка работы или запчасти в форме ТО: нажатие — правка, корзина — удалить, подсказка — заполнить. */
export function LineItemRow({ title, meta, amount, onEdit, onRemove, suggestion }: LineItemRowProps) {
  return (
    <div className={styles.item}>
      <div className={styles.line}>
        <button type="button" className={styles.main} onClick={onEdit}>
          <span className={styles.text}>
            <span className={cx(styles.title, shared.truncate)} title={title}>
              {title}
            </span>
            {meta && (
              <span className={cx(styles.meta, shared.truncate)} title={meta}>
                {meta}
              </span>
            )}
          </span>
          {amount && <span className={styles.amount}>{amount}</span>}
        </button>
        <button type="button" className={styles.remove} aria-label={`Удалить «${title}»`} onClick={onRemove}>
          <IconTrash size={20} stroke={1.75} aria-hidden="true" />
        </button>
      </div>
      {suggestion && (
        <button type="button" className={styles.suggestion} onClick={suggestion.onApply}>
          <IconHistory size={18} stroke={1.75} aria-hidden="true" />
          <span>{suggestion.text}</span>
        </button>
      )}
    </div>
  )
}
