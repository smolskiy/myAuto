import type { ReactNode, TextareaHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'
import { Field } from '../Field/Field'
import styles from './TextArea.module.css'

export type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string
  hint?: ReactNode
  error?: string
}

/** Многострочное поле; растёт по содержимому (field-sizing), не выше 12 строк. */
export function TextArea({ label, hint, error, required, rows = 3, className, ...rest }: TextAreaProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <textarea {...rest} rows={rows} className={cx(styles.textarea, className)} />
    </Field>
  )
}
