import { cx } from '../../lib/cx'
import tones from '../../tones.module.css'
import type { Tone } from '../../types'
import styles from './ProgressBar.module.css'

export interface ProgressBarProps {
  /** Доля 0..1. Больше 1 — полоска полная и тоном overdue. */
  value: number
  tone?: Tone
  /** Доступное имя полоски («Масло: пройдено 92 %»). */
  label?: string
}

export function ProgressBar({ value, tone = 'accent', label }: ProgressBarProps) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0
  const over = safe > 1
  const pct = Math.round(Math.min(safe, 1) * 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cx(styles.track, tones[over ? 'overdue' : tone])}
    >
      <div className={styles.fill} style={{ width: `${pct}%` }} />
    </div>
  )
}
