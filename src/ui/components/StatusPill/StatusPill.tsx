import { IconAlertTriangleFilled, IconCircleCheckFilled, IconClockFilled, IconHelpCircleFilled } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import tones from '../../tones.module.css'
import type { StatusState } from '../../types'
import styles from './StatusPill.module.css'

export interface StatusPillProps {
  state: StatusState
  /** По умолчанию «В порядке» / «Скоро» / «Просрочено» / «Нет данных». */
  children?: ReactNode
}

const LABEL: Record<StatusState, string> = {
  ok: 'В порядке',
  soon: 'Скоро',
  overdue: 'Просрочено',
  unknown: 'Нет данных',
}

const GLYPH = {
  ok: IconCircleCheckFilled,
  soon: IconClockFilled,
  overdue: IconAlertTriangleFilled,
  unknown: IconHelpCircleFilled,
} satisfies Record<StatusState, unknown>

export function StatusPill({ state, children }: StatusPillProps) {
  const Glyph = GLYPH[state]
  return (
    <span className={cx(styles.pill, tones[state])}>
      <Glyph size={14} aria-hidden="true" />
      <span>{children ?? LABEL[state]}</span>
    </span>
  )
}
