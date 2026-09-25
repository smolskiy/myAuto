import { IconAlertCircleFilled, IconAlertTriangleFilled } from '@tabler/icons-react'
import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'
import styles from './Field.module.css'

export interface FieldProps {
  label: string
  hint?: ReactNode
  /** Ошибка: красная рамка, текст под полем, aria-invalid. */
  error?: string
  /** Предупреждение, которое не мешает сохранить (хронология пробега). */
  warning?: string
  required?: boolean
  /** Поле ввода: получает id, aria-describedby, aria-invalid, required. */
  children: ReactElement<Record<string, unknown>>
  /** Содержимое сразу под полем (чипы, быстрые кнопки, подсказки комбобокса) — вне подписи. */
  below?: ReactNode
}

/** Подпись над полем, подсказка и сообщения под ним; связывает их с полем для скринридера. */
export function Field({ label, hint, error, warning, required, children, below }: FieldProps) {
  const id = useId()
  const inputId = (children.props.id as string | undefined) ?? `${id}-input`
  const hintId = hint ? `${id}-hint` : undefined
  const msgId = error || warning ? `${id}-msg` : undefined
  const describedBy = [children.props['aria-describedby'] as string | undefined, hintId, msgId]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
        {required && (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {cloneElement(children, {
        id: inputId,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : undefined,
        required: required || undefined,
      })}
      {below}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      <div aria-live="polite" className={styles.live}>
        {error ? (
          <p id={msgId} className={styles.error}>
            <IconAlertCircleFilled size={16} aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : warning ? (
          <p id={msgId} className={styles.warning}>
            <IconAlertTriangleFilled size={16} aria-hidden="true" />
            <span>{warning}</span>
          </p>
        ) : null}
      </div>
    </div>
  )
}
