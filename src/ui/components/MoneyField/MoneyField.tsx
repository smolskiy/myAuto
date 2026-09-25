import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { formatMoney, formatMoneyInput, groupDigits, hasOperator, parseMoneyExpr } from '../../lib/moneyExpr'
import { Button } from '../Button/Button'
import { Field } from '../Field/Field'
import { InputBox } from '../Field/InputBox'
import styles from './MoneyField.module.css'

export interface MoneyFieldProps {
  label: string
  /** Копейки. */
  value: number | undefined
  /** Копейки; вызывается при потере фокуса, Enter и быстрых кнопках. */
  onChange(kopecks: number | undefined): void
  hint?: ReactNode
  error?: string
  /** Рубли для кнопок «+500». */
  quickAdd?: number[]
}

const INVALID = 'Не получилось посчитать сумму'
const fmt = (k: number | undefined) => (k === undefined ? '' : formatMoneyInput(k))

/** Сумма в рублях с арифметикой: «1200+650» показывает «= 1 850 ₽», в onChange уходят копейки. */
export function MoneyField({ label, value, onChange, hint, error, quickAdd }: MoneyFieldProps) {
  const [text, setText] = useState(() => fmt(value))
  const [prevValue, setPrevValue] = useState(value)
  const [invalid, setInvalid] = useState(false)
  if (value !== prevValue) {
    setPrevValue(value)
    if (value !== (parseMoneyExpr(text) ?? undefined)) {
      setText(fmt(value))
      setInvalid(false)
    }
  }

  const commit = () => {
    if (text.trim() === '') {
      setInvalid(false)
      if (value !== undefined) onChange(undefined)
      return
    }
    const k = parseMoneyExpr(text)
    if (k === null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setText(formatMoneyInput(k))
    onChange(k)
  }

  const add = (rub: number) => {
    const base = parseMoneyExpr(text) ?? value ?? 0
    const next = base + rub * 100
    setInvalid(false)
    setText(formatMoneyInput(next))
    onChange(next)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit()
  }

  const preview = hasOperator(text) ? parseMoneyExpr(text) : null

  return (
    <Field
      label={label}
      hint={hint}
      error={error ?? (invalid ? INVALID : undefined)}
      below={
        <>
          <p className={styles.preview} aria-live="polite">
            {preview !== null ? `= ${formatMoney(preview)}` : ''}
          </p>
          {quickAdd && quickAdd.length > 0 && (
            <div className={styles.quick}>
              {quickAdd.map((rub) => (
                <Button key={rub} variant="secondary" size="sm" onClick={() => add(rub)}>
                  +{groupDigits(String(rub))}
                </Button>
              ))}
            </div>
          )}
        </>
      }
    >
      <InputBox
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        value={text}
        suffix="₽"
        onChange={(e) => {
          setText(e.target.value)
          if (invalid) setInvalid(false)
        }}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </Field>
  )
}
