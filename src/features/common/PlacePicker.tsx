import { usePlaces } from '../../db/hooks'
import { repos } from '../../db/repos'
import type { ID, PlaceKind } from '../../domain/types'
import { Combobox, useToast } from '../../ui'
import { matches, usePickerQuery } from './pickerQuery'
import { useLookup } from './useLookup'

export interface PlacePickerProps {
  /** «Место», «АЗС», «Где купил». */
  label: string
  /** Какие места предлагать; новое создаётся с видом `kinds[0]`. */
  kinds: PlaceKind[]
  value?: ID
  onChange(id?: ID): void
  hint?: string
  error?: string
}

/** Комбобокс мест с созданием нового по введённому названию. */
export function PlacePicker({ label, kinds, value, onChange, hint, error }: PlacePickerProps) {
  const toast = useToast()
  const places = usePlaces()
  const lookup = useLookup()
  // Выбранное место ищем и среди удалённых: у старой записи имя не пропадает.
  const selected = value ? (places?.find((p) => p.id === value) ?? lookup?.places.get(value)) : undefined
  const [query, setQuery] = usePickerQuery(selected?.id, selected?.name)

  const options = (places ?? [])
    .filter((p) => kinds.includes(p.kind) && matches(p.name, query))
    .map((p) => ({ id: p.id, label: p.name, hint: p.address }))

  const create = async (name: string) => {
    try {
      const place = await repos.places.create({ kind: kinds[0] ?? 'other', name })
      onChange(place.id)
    } catch (e) {
      toast.show({ text: (e instanceof Error && e.message) || 'Место не сохранилось' })
    }
  }

  return (
    <Combobox
      label={label}
      value={selected ? { id: selected.id, label: selected.name } : null}
      options={options}
      query={query}
      onQueryChange={setQuery}
      onSelect={(o) => onChange(o?.id)}
      onCreate={(name) => void create(name)}
      hint={hint}
      error={error}
    />
  )
}
