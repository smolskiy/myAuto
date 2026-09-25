import { useCatalog } from '../../db/hooks'
import { repos } from '../../db/repos'
import { ITEM_GROUP_LABELS } from '../../domain/catalog'
import type { CatalogItem, ID } from '../../domain/types'
import { Combobox, useToast } from '../../ui'
import { SAVE_FAILED, userMessage } from './errors'
import { matches, normalize, usePickerQuery } from './pickerQuery'
import { useLookup } from './useLookup'

export interface CatalogItemPickerProps {
  /** По умолчанию «Узел». */
  label?: string
  value?: ID
  onChange(id?: ID, item?: CatalogItem): void
  hint?: string
  error?: string
  /** Набранный текст — шторки строк берут его названием, если узел так и не выбран. */
  onQueryChange?(query: string): void
  /** «Создать «…»» — свой узел в группе «Прочее» по введённому названию. По умолчанию нет (фильтры). */
  allowCreate?: boolean
}

/** Поиск узла по каталогу (по названию и по группе); группа — в подсказке строки. */
export function CatalogItemPicker({
  label = 'Узел',
  value,
  onChange,
  hint,
  error,
  onQueryChange,
  allowCreate = false,
}: CatalogItemPickerProps) {
  const toast = useToast()
  const catalog = useCatalog()
  const lookup = useLookup()
  // Выбранная позиция может быть скрыта или удалена — её имя всё равно показываем.
  const selected = value ? (catalog?.find((i) => i.id === value) ?? lookup?.catalog.get(value)) : undefined
  const [query, setQuery] = usePickerQuery(selected?.id, selected?.name)
  const changeQuery = (q: string) => {
    setQuery(q)
    onQueryChange?.(q)
  }

  // Слова запроса ищутся в названии и группе вместе: «двигатель прокладка».
  const options = (catalog ?? [])
    .filter((i) => matches(`${i.name} ${ITEM_GROUP_LABELS[i.group]}`, query))
    .map((i) => ({ id: i.id, label: i.name, hint: ITEM_GROUP_LABELS[i.group] }))

  const create = async (name: string) => {
    // Такое имя уже есть (скрытый встроенный узел не попадает в подсказки) — выбираем его, а не плодим двойник.
    const same = [...(lookup?.catalog.values() ?? [])].find(
      (i) => !i.deleted && normalize(i.name) === normalize(name),
    )
    if (same) return onChange(same.id, same)
    try {
      const item = await repos.catalog.create({ name, group: 'other', builtin: false })
      onChange(item.id, item)
    } catch (e) {
      toast.show({ text: userMessage(e, SAVE_FAILED) })
    }
  }

  return (
    <Combobox
      label={label}
      value={selected ? { id: selected.id, label: selected.name } : null}
      options={options}
      query={query}
      onQueryChange={changeQuery}
      onSelect={(o) => {
        const item = o ? catalog?.find((i) => i.id === o.id) : undefined
        onChange(item?.id, item)
      }}
      onCreate={allowCreate ? (name) => void create(name) : undefined}
      hint={hint}
      error={error}
    />
  )
}
