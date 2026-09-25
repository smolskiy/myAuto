import { useRef, type KeyboardEvent } from 'react'
import styles from './SegmentedControl.module.css'

export interface SegmentedControlProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  /** NoInfer: тип берётся из value и options, а не из сеттера useState. */
  onChange(v: NoInfer<T>): void
  ariaLabel: string
}

/** Радиогруппа из 2–4 вариантов: стрелки двигают выбор, Tab входит в группу один раз. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )

  const move = (to: number) => {
    const i = (to + options.length) % options.length
    const opt = options[i]
    if (!opt) return
    onChange(opt.value)
    refs.current[i]?.focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (step !== undefined) move(current + step)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(options.length - 1)
    else return
    e.preventDefault()
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} className={styles.group} onKeyDown={onKeyDown}>
      {options.map((o, i) => {
        const checked = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === current ? 0 : -1}
            className={styles.segment}
            onClick={() => onChange(o.value)}
          >
            <span className={styles.label}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
