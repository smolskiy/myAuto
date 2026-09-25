import { IconCheck } from '@tabler/icons-react'
import styles from './Checkbox.module.css'

export interface CheckboxProps {
  label: string
  checked: boolean
  onChange(v: boolean): void
}

/** Флажок со строкой-подписью; нажимается вся строка («Полный бак», «Делал сам»). */
export function Checkbox({ label, checked, onChange }: CheckboxProps) {
  return (
    <label className={styles.row}>
      <input
        type="checkbox"
        className={styles.input}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={styles.box} aria-hidden="true">
        <IconCheck className={styles.check} size={18} stroke={3} />
      </span>
      <span className={styles.label}>{label}</span>
    </label>
  )
}
