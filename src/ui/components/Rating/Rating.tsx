import { IconStar, IconStarFilled } from '@tabler/icons-react'
import { useRef, type KeyboardEvent } from 'react'
import styles from './Rating.module.css'

type Stars = 1 | 2 | 3 | 4 | 5

export interface RatingProps {
  value: Stars | undefined
  /** Без обработчика — только показ. Повторное нажатие на выбранную звезду снимает оценку. */
  onChange?(v: Stars | undefined): void
  /** По умолчанию «Оценка». */
  label?: string
}

const STARS: Stars[] = [1, 2, 3, 4, 5]

export function Rating({ value, onChange, label = 'Оценка' }: RatingProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  if (!onChange) {
    return (
      <span
        role="img"
        aria-label={value ? `${label}: ${value} из 5` : `${label}: нет`}
        className={styles.readonly}
      >
        {STARS.map((n) =>
          value && n <= value ? (
            <IconStarFilled key={n} className={styles.on} size={16} />
          ) : (
            <IconStar key={n} className={styles.off} size={16} stroke={1.75} />
          ),
        )}
      </span>
    )
  }

  const focusIndex = value ? value - 1 : 0
  const move = (to: number) => {
    const n = STARS[Math.min(4, Math.max(0, to))]!
    onChange(n)
    refs.current[n - 1]?.focus()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key]
    if (step === undefined) return
    e.preventDefault()
    move((value ? value - 1 : -1) + step)
  }

  return (
    <div role="radiogroup" aria-label={label} className={styles.group} onKeyDown={onKeyDown}>
      {STARS.map((n, i) => {
        const on = !!value && n <= value
        return (
          <button
            key={n}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} из 5`}
            tabIndex={i === focusIndex ? 0 : -1}
            className={styles.star}
            onClick={() => onChange(value === n ? undefined : n)}
          >
            {on ? (
              <IconStarFilled className={styles.on} size={28} aria-hidden="true" />
            ) : (
              <IconStar className={styles.off} size={28} stroke={1.5} aria-hidden="true" />
            )}
          </button>
        )
      })}
    </div>
  )
}
