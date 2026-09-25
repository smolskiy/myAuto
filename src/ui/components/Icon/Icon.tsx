import type { ComponentType } from 'react'
import { cx } from '../../lib/cx'
import tones from '../../tones.module.css'
import type { RecordKindTone, Tone } from '../../types'
import styles from './Icon.module.css'

export interface IconProps {
  /** Компонент иконки Tabler (`IconTool`, `IconGasStation` …). */
  icon: ComponentType<{ size?: number; stroke?: number }>
  size?: 16 | 20 | 24
  /** Без тона — цвет текста вокруг. */
  tone?: Tone | RecordKindTone
  /** Кружок-подложка тона (-soft) вокруг значка. */
  circle?: boolean
}

export function Icon({ icon: Glyph, size = 20, tone, circle = false }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        styles.icon,
        tone && tones[tone],
        tone && styles.toned,
        circle && styles.circle,
        styles[`s${size}`],
      )}
    >
      <Glyph size={size} stroke={size === 16 ? 2 : 1.75} />
    </span>
  )
}
