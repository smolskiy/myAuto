import { cx } from '../../lib/cx'
import shared from '../../shared.module.css'
import type { StatusState, Tone } from '../../types'
import { ProgressBar } from '../ProgressBar/ProgressBar'
import { StatusPill } from '../StatusPill/StatusPill'
import styles from './ReminderCard.module.css'

export interface ReminderCardProps {
  title: string
  state: StatusState
  /** «через 1 200 км» / «просрочено на 300 км» */
  kmText?: string
  /** «через 112 дней» */
  timeText?: string
  /** Доля пройденного интервала по пробегу, 0..1+ */
  progressKm?: number
  /** Доля пройденного интервала по времени, 0..1+ */
  progressTime?: number
  /** «≈ 19 октября» */
  predicted?: string
  /** «последняя: 15.01.2026, 140 000 км» */
  lastText?: string
  /** Строка для главной: одна полоска (большая из двух), без подробностей. */
  compact?: boolean
  onClick?(): void
}

const STATE_TONE: Record<StatusState, Tone> = {
  ok: 'ok',
  soon: 'soon',
  overdue: 'overdue',
  unknown: 'neutral',
}
const pct = (v: number) => Math.round(Math.max(0, v) * 100)

export function ReminderCard(props: ReminderCardProps) {
  const { title, state, kmText, timeText, progressKm, progressTime, predicted, lastText, compact, onClick } =
    props
  const tone = STATE_TONE[state]

  const heading = onClick ? (
    <button type="button" className={cx(styles.titleButton, shared.truncate)} onClick={onClick}>
      {title}
    </button>
  ) : (
    <span className={shared.truncate}>{title}</span>
  )

  if (compact) {
    const worst = Math.max(progressKm ?? 0, progressTime ?? 0)
    const hasProgress = progressKm !== undefined || progressTime !== undefined
    const meta = [kmText, timeText].filter(Boolean).join(' · ')
    return (
      <div className={cx(styles.card, styles.compact, onClick && styles.interactive)}>
        <div className={styles.head}>
          <span className={styles.title}>{heading}</span>
          <StatusPill state={state} />
        </div>
        {meta && <p className={cx(styles.meta, shared.truncate)}>{meta}</p>}
        {hasProgress && (
          <ProgressBar value={worst} tone={tone} label={`${title}: пройдено ${pct(worst)} %`} />
        )}
      </div>
    )
  }

  return (
    <div className={cx(styles.card, onClick && styles.interactive)}>
      <div className={styles.head}>
        <span className={styles.title}>{heading}</span>
        <StatusPill state={state} />
      </div>
      {(kmText || progressKm !== undefined) && (
        <div className={styles.metric}>
          <div className={styles.metricLine}>
            <span className={styles.metricName}>Пробег</span>
            {kmText && <span className={styles.metricValue}>{kmText}</span>}
          </div>
          {progressKm !== undefined && (
            <ProgressBar value={progressKm} tone={tone} label={`${title}: по пробегу ${pct(progressKm)} %`} />
          )}
        </div>
      )}
      {(timeText || progressTime !== undefined) && (
        <div className={styles.metric}>
          <div className={styles.metricLine}>
            <span className={styles.metricName}>Время</span>
            {timeText && <span className={styles.metricValue}>{timeText}</span>}
          </div>
          {progressTime !== undefined && (
            <ProgressBar
              value={progressTime}
              tone={tone}
              label={`${title}: по времени ${pct(progressTime)} %`}
            />
          )}
        </div>
      )}
      {(predicted || lastText) && (
        <div className={styles.foot}>
          {predicted && <span className={styles.predicted}>Прогноз: {predicted}</span>}
          {lastText && <span className={styles.last}>{lastText}</span>}
        </div>
      )}
    </div>
  )
}
