import styles from './Spinner.module.css'

export interface SpinnerProps {
  size?: 16 | 24
  /**
   * Подпись для скринридера — скрытым текстом в живой области (role=status), его объявляют.
   * Без неё спиннер декоративный (например, внутри кнопки с aria-busy).
   */
  label?: string
}

export function Spinner({ size = 24, label }: SpinnerProps) {
  const svg = (
    <svg
      className={styles.spinner}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className={styles.track} cx="12" cy="12" r="9.5" strokeWidth="2.5" />
      <path
        className={styles.arc}
        d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
  if (!label) return svg
  return (
    <span role="status" className={styles.wrap}>
      {svg}
      <span className="visually-hidden">{label}</span>
    </span>
  )
}
