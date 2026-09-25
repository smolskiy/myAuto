import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import tones from '../../tones.module.css'
import type { Tone } from '../../types'
import styles from './Badge.module.css'

export interface BadgeProps {
  children: ReactNode
  tone?: Tone
}

export function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return <span className={cx(styles.badge, tones[tone])}>{children}</span>
}
