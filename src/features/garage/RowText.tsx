import { IconStarFilled } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import type { Rating } from '../../domain/types'
import styles from './RowText.module.css'

/**
 * Подзаголовок строки списка в несколько строк: каждая обрезается сама. ListItem даёт одну строку подзаголовка,
 * а в строке гаража, шин и документов справа не остаётся места под значение — пробег и срок уходят второй строкой.
 */
export function SubtitleLines({ lines }: { lines: ReactNode[] }) {
  const shown = lines.filter((l) => l !== undefined && l !== null && l !== false && l !== '')
  if (shown.length === 0) return null
  return (
    <>
      {shown.map((line, i) => (
        <span key={i} className={styles.line}>
          {line}
        </span>
      ))}
    </>
  )
}

/** Оценка в строке списка: одна звезда и число — пять звёзд съедали бы название. */
export function RatingMark({ value }: { value: Rating }) {
  return (
    <span role="img" aria-label={`Оценка: ${value} из 5`} className={styles.rating}>
      <IconStarFilled size={16} aria-hidden="true" />
      {value}
    </span>
  )
}
