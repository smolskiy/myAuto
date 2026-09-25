import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react'
import { formatMoney, formatMoneyInput, groupDigits, hasOperator, parseMoneyExpr } from '../../lib/moneyExpr'
import { Button } from '../Button/Button'
import { Field } from '../Field/Field'
import { InputBox } from '../Field/InputBox'
import styles from './MoneyField.module.css'

export interface MoneyFieldProps {
  label: string
  /** Копейки. */
  value: number | undefined
  /**
   * Копейки; вызывается на каждый ввод, который разбирается (пустое поле — undefined),
   * и на быстрые кнопки. Недописанное выражение («1200+») значение не меняет.
   */
  onChange(kopecks: number | undefined): void
  hint?: ReactNode
  error?: string
  /** Рубли для кнопок «+500». */
  quickAdd?: number[]
}

const INVALID = 'Не получилось посчитать сумму'
const fmt = (k: number | undefined) => (k === undefined ? '' : formatMoneyInput(k))
/** Разбор текста поля: пусто → undefined, ошибка → null. */
const parse = (text: string) => (text.trim() === '' ? undefined : parseMoneyExpr(text))
/** Кнопка не забирает фокус у поля — экранная клавиатура не закрывается. */
const keepFocus = (e: SyntheticEvent) => e.preventDefault()

/**
 * Сумма в рублях с арифметикой: «1200+650» показывает «= 1 850 ₽», в onChange уходят копейки.
 * Клавиша «+» первой в ряду быстрых сумм — на цифровой клавиатуре iPhone плюса нет.
 */
export function MoneyField({ label, value, onChange, hint, error, quickAdd }: MoneyFieldProps) {
  const [text, setText] = useState(() => fmt(value))
  const [prevValue, setPrevValue] = useState(value)
  const [invalid, setInvalid] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)

  // Значение сменили снаружи (не наш ввод) — показываем его.
  if (value !== prevValue) {
    setPrevValue(value)
    if (value !== (parse(text) ?? undefined)) {
      setText(fmt(value))
      setInvalid(false)
    }
  }

  useLayoutEffect(() => {
    if (caret.current === null || !inputRef.current) return
    inputRef.current.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [text])

  const edit = (next: string) => {
    setText(next)
    if (invalid) setInvalid(false)
    const k = parse(next)
    if (k !== null) onChange(k)
  }

  /** Потеря фокуса: разряды пробелами или сообщение об ошибке. */
  const commit = () => {
    const k = parse(text)
    if (k === null) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setText(fmt(k))
  }

  const add = (rub: number) => {
    const next = (parse(text) ?? value ?? 0) + rub * 100
    setInvalid(false)
    setText(formatMoneyInput(next))
    onChange(next)
  }

  const insertPlus = () => {
    const input = inputRef.current
    const start = input?.selectionStart ?? text.length
    const end = input?.selectionEnd ?? text.length
    caret.current = start + 1
    edit(`${text.slice(0, start)}+${text.slice(end)}`)
    input?.focus({ preventScroll: true })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    if (parse(text) === null) {
      // Некорректное выражение не отправляет форму со старым значением.
      e.preventDefault()
      setInvalid(true)
      return
    }
    commit()
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
          <div className={styles.quick}>
            <Button
              variant="secondary"
              size="sm"
              className={styles.opKey}
              aria-label="Плюс"
              onPointerDown={keepFocus}
              onMouseDown={keepFocus}
              onClick={insertPlus}
            >
              +
            </Button>
            {quickAdd?.map((rub) => (
              <Button key={rub} variant="secondary" size="sm" onClick={() => add(rub)}>
                +{groupDigits(String(rub))}
              </Button>
            ))}
          </div>
        </>
      }
    >
      <InputBox
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        value={text}
        suffix="₽"
        onChange={(e) => edit(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </Field>
  )
}
