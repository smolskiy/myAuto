import { cx } from '../../lib/cx'
import shared from '../../shared.module.css'
import tones from '../../tones.module.css'
import type { Tone } from '../../types'
import styles from './StatTile.module.css'

export interface StatTileProps {
  label: string
  /** Готовая строка («12 450 ₽», «7,8 л/100 км»). */
  value: string
  hint?: string
  /** Цвет подсказки: рост расходов — soon, экономия — ok. */
  tone?: Tone
  onClick?(): void
}

export function StatTile({ label, value, hint, tone = 'neutral', onClick }: StatTileProps) {
  const body = (
    <>
      <span className={cx(styles.label, shared.truncate)}>{label}</span>
      <span className={cx(styles.value, shared.truncate)}>{value}</span>
      {hint && <span className={cx(styles.hint, tones[tone], shared.truncate)}>{hint}</span>}
    </>
  )
  return onClick ? (
    <button type="button" className={cx(styles.tile, styles.interactive)} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={styles.tile}>{body}</div>
  )
}
