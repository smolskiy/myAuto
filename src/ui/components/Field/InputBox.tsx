import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from '../../lib/cx'
import styles from './Field.module.css'

export type InputBoxProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Значок слева (лупа в поиске). */
  start?: ReactNode
  /** Единица справа («км», «л», «₽»). */
  suffix?: ReactNode
  /** Кнопка справа (очистить). */
  end?: ReactNode
  ref?: Ref<HTMLInputElement>
}

/** Коробка поля: рамка, фокус, приставки. Атрибуты (id, aria-*) уходят на сам <input>. */
export function InputBox({ start, suffix, end, className, ...input }: InputBoxProps) {
  return (
    <div className={styles.control}>
      {start && (
        <span className={styles.adornment} aria-hidden="true">
          {start}
        </span>
      )}
      <input {...input} className={cx(styles.input, className)} />
      {suffix && (
        <span className={styles.affix} aria-hidden="true">
          {suffix}
        </span>
      )}
      {end}
    </div>
  )
}
