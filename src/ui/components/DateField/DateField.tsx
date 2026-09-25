import type { ReactNode } from 'react'
import { Chip } from '../Chip/Chip'
import { Field } from '../Field/Field'
import { InputBox } from '../Field/InputBox'
import styles from './DateField.module.css'

export interface DateFieldProps {
  label: string
  /** YYYY-MM-DD */
  value: string
  onChange(v: string): void
  /** Сегодня (YYYY-MM-DD) — приходит параметром, компонент не смотрит на часы. */
  today: string
  /** Чипы «Сегодня» / «Вчера» под полем. */
  quick?: boolean
  max?: string
  hint?: ReactNode
  error?: string
}

/** День до `iso` на `days` (UTC — без сдвигов из-за часового пояса). */
function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y!, m! - 1, d! + days))
  return t.toISOString().slice(0, 10)
}

/** Нативный выбор даты (оформлен токенами) и быстрые чипы. */
export function DateField({ label, value, onChange, today, quick, max, hint, error }: DateFieldProps) {
  const yesterday = shiftDay(today, -1)
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      below={
        quick ? (
          <div className={styles.quick}>
            <Chip selected={value === today} onClick={() => onChange(today)}>
              Сегодня
            </Chip>
            <Chip selected={value === yesterday} onClick={() => onChange(yesterday)}>
              Вчера
            </Chip>
          </div>
        ) : undefined
      }
    >
      <InputBox
        type="date"
        className={styles.input}
        value={value}
        max={max}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  )
}
