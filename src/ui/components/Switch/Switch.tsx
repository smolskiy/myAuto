import { useId } from 'react'
import styles from './Switch.module.css'

export interface SwitchProps {
  label: string
  checked: boolean
  onChange(v: boolean): void
  hint?: string
}

/** Строка-переключатель: нажимается вся строка, роль switch. Годится строкой в ListGroup. */
export function Switch({ label, checked, onChange, hint }: SwitchProps) {
  const id = useId()
  return (
    <label className={styles.row}>
      <span className={styles.text}>
        <span id={`${id}-label`} className={styles.label}>
          {label}
        </span>
        {hint && (
          <span id={`${id}-hint`} className={styles.hint}>
            {hint}
          </span>
        )}
      </span>
      <input
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
    </label>
  )
}
