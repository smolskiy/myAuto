import { useState, type ChangeEvent, type ReactNode } from 'react'
import { formatNumberInput, isNumberDraft, parseNumberDraft } from '../../lib/numberInput'
import { Field } from '../Field/Field'
import { InputBox } from '../Field/InputBox'

export interface NumberFieldProps {
  label: string
  value: number | undefined
  /** Вызывается на каждый ввод: число или undefined, если поле пустое. */
  onChange(v: number | undefined): void
  /** 'км' | 'л' | '₽' — справа в поле. */
  unit?: string
  decimals?: 0 | 1 | 2
  /** Меньше — при потере фокуса поднимается до min. */
  min?: number
  hint?: ReactNode
  error?: string
  /** Не мешает сохранить (например, нарушение хронологии пробега). */
  warning?: string
  placeholder?: string
}

/** Число с единицей: `inputmode="decimal"`, запятая или точка, разряды пробелами после ввода. */
export function NumberField({
  label,
  value,
  onChange,
  unit,
  decimals = 0,
  min,
  hint,
  error,
  warning,
  placeholder,
}: NumberFieldProps) {
  const [text, setText] = useState(() => formatNumberInput(value, decimals))
  const [prevValue, setPrevValue] = useState(value)
  // Значение сменили снаружи (не наш ввод) — показываем его.
  if (value !== prevValue) {
    setPrevValue(value)
    if (value !== parseNumberDraft(text)) setText(formatNumberInput(value, decimals))
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    if (!isNumberDraft(next, decimals)) return
    setText(next)
    onChange(parseNumberDraft(next))
  }

  const handleBlur = () => {
    let n = parseNumberDraft(text)
    if (n !== undefined && min !== undefined && n < min) {
      n = min
      onChange(n)
    }
    setText(formatNumberInput(n, decimals))
  }

  return (
    <Field label={label} hint={hint} error={error} warning={warning}>
      <InputBox
        type="text"
        inputMode={decimals === 0 ? 'numeric' : 'decimal'}
        autoComplete="off"
        enterKeyHint="done"
        value={text}
        placeholder={placeholder}
        suffix={unit}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    </Field>
  )
}
