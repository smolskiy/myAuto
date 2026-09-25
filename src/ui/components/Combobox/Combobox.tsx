import { IconCheck, IconPlus, IconX } from '@tabler/icons-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cx } from '../../lib/cx'
import { Field } from '../Field/Field'
import { InputBox } from '../Field/InputBox'
import styles from './Combobox.module.css'

export interface ComboboxOption {
  id: string
  label: string
  hint?: string
}

export interface ComboboxProps {
  label: string
  value: ComboboxOption | null
  /** Уже отфильтрованы вызывающим по `query`. */
  options: ComboboxOption[]
  query: string
  onQueryChange(q: string): void
  /** null — выбор снят (поле очищено или текст изменён). */
  onSelect(o: ComboboxOption | null): void
  /** Показывает пункт «Создать «…»», если точного совпадения нет. */
  onCreate?(label: string): void
  placeholder?: string
  /** По умолчанию «Ничего не найдено». */
  emptyText?: string
  hint?: string
  error?: string
}

type Item = { type: 'option'; option: ComboboxOption } | { type: 'create'; label: string }

/** Для сравнения с набранным: без пробелов по краям, без регистра, «ё» — как «е». */
const sameText = (s: string) => s.trim().toLowerCase().replaceAll('ё', 'е')

/** Поле с подсказками по ARIA 1.2: стрелки выбирают, Enter подтверждает, Escape закрывает. */
export function Combobox(props: ComboboxProps) {
  const { label, value, options, query, onQueryChange, onSelect, onCreate, placeholder, hint, error } = props
  const emptyText = props.emptyText ?? 'Ничего не найдено'
  const id = useId()
  const listId = `${id}-list`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const trimmed = query.trim()
  const exact = options.some((o) => sameText(o.label) === sameText(trimmed))
  const items: Item[] = [
    ...options.map((option): Item => ({ type: 'option', option })),
    ...(onCreate && trimmed && !exact ? [{ type: 'create', label: trimmed } as Item] : []),
  ]
  const showEmpty = open && trimmed !== '' && items.length === 0
  const expanded = open && items.length > 0
  const optionId = (i: number) => `${id}-opt-${i}`
  const listRef = useRef<HTMLUListElement>(null)
  // Поле внизу экрана (над кнопкой формы или клавиатурой): открытый список прокручиваем в видимую часть.
  useEffect(() => {
    if (expanded) listRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [expanded])

  const choose = (item: Item) => {
    if (item.type === 'option') {
      onSelect(item.option)
      onQueryChange(item.option.label)
    } else {
      onCreate?.(item.label)
    }
    setOpen(false)
    setActive(-1)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) setOpen(true)
      if (items.length === 0) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((a) => (a + step + items.length) % items.length)
    } else if (e.key === 'Enter') {
      const item = expanded && active >= 0 ? items[active] : undefined
      if (item) {
        e.preventDefault()
        choose(item)
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setActive(-1)
      }
    }
  }

  const selected = value !== null && value.label === query

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      below={
        <>
          {expanded && (
            <ul ref={listRef} id={listId} role="listbox" aria-label={label} className={styles.list}>
              {items.map((item, i) => (
                <li
                  key={item.type === 'option' ? item.option.id : '__create'}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  data-active={i === active || undefined}
                  className={cx(styles.option, i === active && styles.active)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(item)}
                >
                  {item.type === 'option' ? (
                    <>
                      <span className={styles.optionLabel}>{item.option.label}</span>
                      {item.option.hint && <span className={styles.optionHint}>{item.option.hint}</span>}
                    </>
                  ) : (
                    <span className={styles.create}>
                      <IconPlus size={18} stroke={2} aria-hidden="true" />
                      {`Создать «${item.label}»`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {showEmpty && <p className={styles.empty}>{emptyText}</p>}
        </>
      }
    >
      <InputBox
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          onQueryChange(e.target.value)
          if (value !== null) onSelect(null)
          setOpen(true)
          setActive(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
        end={
          query ? (
            <span className={styles.end}>
              {selected && <IconCheck className={styles.check} size={20} stroke={2} aria-hidden="true" />}
              <button
                type="button"
                className={styles.clear}
                aria-label="Очистить"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onQueryChange('')
                  if (value !== null) onSelect(null)
                }}
              >
                <IconX size={18} stroke={2} aria-hidden="true" />
              </button>
            </span>
          ) : undefined
        }
      />
    </Field>
  )
}
