import styles from './SectionHeader.module.css'

export interface SectionHeaderProps {
  title: string
  /** Ссылка-действие справа («Все», «Добавить»). */
  action?: { label: string; onClick(): void }
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className={styles.header}>
      <h2 className={styles.title}>{title}</h2>
      {action && (
        <button type="button" className={styles.action} onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  )
}
