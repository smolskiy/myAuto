import { useCatalog } from '../../db/hooks'
import { ITEM_GROUP_LABELS } from '../../domain/catalog'
import type { CatalogItem, ID } from '../../domain/types'
import { Combobox } from '../../ui'
import { matches, usePickerQuery } from './pickerQuery'
import { useLookup } from './useLookup'

export interface CatalogItemPickerProps {
  /** По умолчанию «Узел». */
  label?: string
  value?: ID
  onChange(id?: ID, item?: CatalogItem): void
  hint?: string
  error?: string
}

/** Поиск узла по каталогу (по названию и по группе); группа — в подсказке строки. */
export function CatalogItemPicker({ label = 'Узел', value, onChange, hint, error }: CatalogItemPickerProps) {
  const catalog = useCatalog()
  const lookup = useLookup()
  // Выбранная позиция может быть скрыта или удалена — её имя всё равно показываем.
  const selected = value ? (catalog?.find((i) => i.id === value) ?? lookup?.catalog.get(value)) : undefined
  const [query, setQuery] = usePickerQuery(selected?.id, selected?.name)

  const options = (catalog ?? [])
    .filter((i) => matches(i.name, query) || matches(ITEM_GROUP_LABELS[i.group], query))
    .map((i) => ({ id: i.id, label: i.name, hint: ITEM_GROUP_LABELS[i.group] }))

  return (
    <Combobox
      label={label}
      value={selected ? { id: selected.id, label: selected.name } : null}
      options={options}
      query={query}
      onQueryChange={setQuery}
      onSelect={(o) => {
        const item = o ? catalog?.find((i) => i.id === o.id) : undefined
        onChange(item?.id, item)
      }}
      hint={hint}
      error={error}
    />
  )
}
