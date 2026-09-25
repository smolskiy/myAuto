import { IconSearch, IconX } from '@tabler/icons-react'
import { useRef } from 'react'
import styles from './SearchField.module.css'

export interface SearchFieldProps {
  value: string
  onChange(v: string): void
  /** Он же доступное имя. По умолчанию «Поиск по журналу». */
  placeholder?: string
}

export function SearchField({ value, onChange, placeholder = 'Поиск по журналу' }: SearchFieldProps) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className={styles.box} role="search">
      <IconSearch className={styles.icon} size={20} stroke={2} aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        className={styles.input}
        aria-label={placeholder}
        placeholder={placeholder}
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            // Очищаем поиск и не даём Escape закрыть шторку/экран вокруг; пустой поиск Escape пропускает.
            e.preventDefault()
            e.stopPropagation()
            e.nativeEvent.stopImmediatePropagation()
            onChange('')
          }
        }}
      />
      {value && (
        <button
          type="button"
          className={styles.clear}
          aria-label="Очистить поиск"
          onClick={() => {
            onChange('')
            ref.current?.focus()
          }}
        >
          <IconX size={18} stroke={2} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
