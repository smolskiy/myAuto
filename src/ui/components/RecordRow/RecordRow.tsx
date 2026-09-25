import { IconPaperclip } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import shared from '../../shared.module.css'
import tones from '../../tones.module.css'
import type { RecordKindTone } from '../../types'
import styles from './RecordRow.module.css'

export interface RecordRowProps {
  kind: RecordKindTone
  /** Значок типа (`<IconTool />`) — рисуется в кружке цвета типа. */
  icon: ReactNode
  title: string
  /** «145 100 км · Автосервис» */
  subtitle?: string
  /** «12 450 ₽» */
  amount?: string
  /** «12 сен» */
  date?: string
  /** Число вложений — скрепка с числом. */
  attachments?: number
  onClick?(): void
}

export function RecordRow({ kind, icon, title, subtitle, amount, date, attachments, onClick }: RecordRowProps) {
  const body = (
    <>
      <span className={cx(styles.icon, tones[kind])} aria-hidden="true" data-leading="">
        {icon}
      </span>
      <span className={styles.main}>
        <span className={cx(styles.title, shared.truncate)} title={title}>
          {title}
        </span>
        {(subtitle || !!attachments) && (
          <span className={styles.meta}>
            {subtitle && (
              <span className={shared.truncate} title={subtitle}>
                {subtitle}
              </span>
            )}
            {!!attachments && (
              <span className={styles.attachments}>
                <IconPaperclip size={14} stroke={2} aria-hidden="true" />
                <span className="visually-hidden">вложений:</span>
                {attachments}
              </span>
            )}
          </span>
        )}
      </span>
      {(amount || date) && (
        <span className={styles.side}>
          {amount && <span className={styles.amount}>{amount}</span>}
          {date && <span className={styles.date}>{date}</span>}
        </span>
      )}
    </>
  )
  return onClick ? (
    <button type="button" className={cx(styles.row, styles.interactive)} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={styles.row}>{body}</div>
  )
}
