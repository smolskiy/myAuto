import { usePlaces } from '../../db/hooks'
import { repos } from '../../db/repos'
import { fuelBrandHint, searchFuelBrands } from '../../domain/fuelBrands'
import { isKnownPlace, placeFromDirectory, searchDirectory } from '../../domain/placeDirectory'
import type { ID, PlaceKind } from '../../domain/types'
import { Combobox, useToast, type ComboboxOption } from '../../ui'
import { useDirectory, useDirectoryCity } from './directory'
import { SAVE_FAILED, userMessage } from './errors'
import { matches, normalize, usePickerQuery } from './pickerQuery'
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

/** id подсказок справочника и сетей АЗС в списке — не путать с id своих мест. */
const DIRECTORY_PREFIX = 'directory:'
const BRAND_PREFIX = 'brand:'
/** Виды мест, для которых есть справочник города. */
const DIRECTORY_KINDS: PlaceKind[] = ['service', 'tire', 'fuel']
/** Для сравнения имён: регистр, «ё» и пробелы по краям не важны. */
const sameName = (a: string, b: string) => normalize(a) === normalize(b)
/** Подсказок справочника в списке — не больше: остальное находится уточнением. */
const DIRECTORY_LIMIT = 8

/**
 * Комбобокс мест с созданием нового по введённому названию. С двух букв — ещё подсказки: у АЗС — сети юга России и
 * Крыма, у СТО, шиномонтажа и АЗС — места справочника выбранного города. Выбор подсказки заводит своё место (из
 * справочника — с адресом, телефоном и ссылкой на карты).
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

  const typed = allowCreate && places !== undefined && query.trim().length >= 2
  const city = useDirectoryCity()
  const directory = useDirectory(
    allowCreate && kinds.some((k) => DIRECTORY_KINDS.includes(k)) ? city : undefined,
  )
  const found =
    directory && typed
      ? searchDirectory(directory.places, query)
          .filter((e) => kinds.includes(e.kind) && !isKnownPlace(e, places ?? []))
          .slice(0, DIRECTORY_LIMIT)
      : []
  // Сеть, чьё имя уже у своей АЗС, второй раз не предлагаем — своя строка и так в списке.
  const brands =
    typed && kinds.includes('fuel')
      ? searchFuelBrands(query).filter(
          (b) => !(places ?? []).some((p) => p.kind === 'fuel' && sameName(p.name, b.name)),
        )
      : []

  const options: ComboboxOption[] = [
    ...(places ?? [])
      .filter((p) => kinds.includes(p.kind) && matches(p.name, query))
      .map((p) => ({ id: p.id, label: p.name, hint: p.address })),
    ...brands.map((b) => ({ id: BRAND_PREFIX + b.name, label: b.name, hint: fuelBrandHint(b) })),
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
    if (o?.id.startsWith(BRAND_PREFIX)) return void create({ kind: 'fuel', name: o.label })
    if (!o?.id.startsWith(DIRECTORY_PREFIX)) return onChange(o?.id)
    const entry = found.find((e) => DIRECTORY_PREFIX + e.id === o.id)
    // Вид — справочника: поле предлагает только свои виды (шиномонтаж в поле ТО — «шины»).
    if (entry) void create(placeFromDirectory(entry))
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
