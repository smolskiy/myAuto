import { usePlaces } from '../../db/hooks'
import { repos } from '../../db/repos'
import { isKnownPlace, placeFromDirectory, searchDirectory } from '../../domain/placeDirectory'
import type { ID, PlaceKind } from '../../domain/types'
import { Combobox, useToast, type ComboboxOption } from '../../ui'
import { useDirectory, useDirectoryCity } from './directory'
import { SAVE_FAILED, userMessage } from './errors'
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
  /** «Создать «…»» по введённому названию; `false` — только выбор (фильтр журнала). По умолчанию `true`. */
  allowCreate?: boolean
}

/** id подсказки справочника в списке — не путать с id своих мест. */
const DIRECTORY_PREFIX = 'directory:'
/** Подсказок справочника в списке — не больше: остальное находится уточнением. */
const DIRECTORY_LIMIT = 8

/**
 * Комбобокс мест с созданием нового по введённому названию. Для СТО и шиномонтажа — ещё подсказки справочника
 * выбранного города (с двух букв): выбор заводит своё место с адресом, телефоном и ссылкой на карты.
 */
export function PlacePicker({
  label,
  kinds,
  value,
  onChange,
  hint,
  error,
  allowCreate = true,
}: PlacePickerProps) {
  const toast = useToast()
  const places = usePlaces()
  const lookup = useLookup()
  // Выбранное место ищем и среди удалённых: у старой записи имя не пропадает.
  const selected = value ? (places?.find((p) => p.id === value) ?? lookup?.places.get(value)) : undefined
  const [query, setQuery] = usePickerQuery(selected?.id, selected?.name)

  const city = useDirectoryCity()
  const repair = allowCreate && kinds.some((k) => k === 'service' || k === 'tire')
  const directory = useDirectory(repair ? city : undefined)
  const found =
    directory && places && query.trim().length >= 2
      ? searchDirectory(directory.places, query)
          .filter((e) => !isKnownPlace(e, places))
          .slice(0, DIRECTORY_LIMIT)
      : []

  const options: ComboboxOption[] = [
    ...(places ?? [])
      .filter((p) => kinds.includes(p.kind) && matches(p.name, query))
      .map((p) => ({ id: p.id, label: p.name, hint: p.address })),
    // Адрес — в самой строке: у справочника много «Шиномонтажей», а точное совпадение названия прячет «Создать».
    ...found.map((e) => ({
      id: DIRECTORY_PREFIX + e.id,
      label: e.address ? `${e.name}, ${e.address}` : e.name,
      hint: 'Яндекс Карты',
    })),
  ]

  const create = async (draft: Parameters<typeof repos.places.create>[0]) => {
    try {
      const place = await repos.places.create(draft)
      onChange(place.id)
    } catch (e) {
      toast.show({ text: userMessage(e, SAVE_FAILED) })
    }
  }

  const select = (o: ComboboxOption | null) => {
    if (!o?.id.startsWith(DIRECTORY_PREFIX)) return onChange(o?.id)
    const entry = found.find((e) => DIRECTORY_PREFIX + e.id === o.id)
    if (!entry) return
    // Вид справочника, если поле его принимает (шиномонтаж в поле ТО), иначе — вид поля.
    void create(placeFromDirectory(entry, kinds.includes(entry.kind) ? entry.kind : kinds[0]))
  }

  return (
    <Combobox
      label={label}
      value={selected ? { id: selected.id, label: selected.name } : null}
      options={options}
      query={query}
      onQueryChange={setQuery}
      onSelect={select}
      onCreate={allowCreate ? (name) => void create({ kind: kinds[0] ?? 'other', name }) : undefined}
      hint={hint}
      error={error}
    />
  )
}
