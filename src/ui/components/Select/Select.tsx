import { IconChevronDown } from '@tabler/icons-react'
import { Field } from '../Field/Field'
import styles from './Select.module.css'

export interface SelectProps<T extends string> {
  label: string
  value: T | undefined
  options: { value: T; label: string }[]
  onChange(v: T): void
  placeholder?: string
  hint?: string
  error?: string
}

/** Нативный список выбора — системное колесо на телефоне, оформление токенами. */
export function Select<T extends string>({ label, value, options, onChange, placeholder, hint, error }: SelectProps<T>) {
  return (
    <Field label={label} hint={hint} error={error}>
      <SelectBox value={value ?? ''} placeholder={placeholder} options={options} onChange={(v) => onChange(v as T)} />
    </Field>
  )
}

function SelectBox({
  value,
  options,
  placeholder,
  onChange,
  ...aria
}: {
  value: string
  options: { value: string; label: string }[]
  placeholder?: string
  onChange(v: string): void
}) {
  return (
    <div className={styles.control}>
      <select {...aria} className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
        {(value === '' || placeholder) && (
          <option value="" disabled>
            {placeholder ?? 'Выберите'}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <IconChevronDown className={styles.chevron} size={20} stroke={2} aria-hidden="true" />
    </div>
  )
}
