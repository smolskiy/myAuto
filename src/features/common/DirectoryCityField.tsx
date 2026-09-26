import { DIRECTORY_CITIES, isDirectoryCity } from '../../domain/placeDirectory'
import { Select } from '../../ui'
import { setDirectoryCity, useDirectoryCity } from './directory'

const NO_CITY = 'none'
const CITY_OPTIONS = [
  { value: NO_CITY, label: 'Не выбран' },
  ...DIRECTORY_CITIES.map((c) => ({ value: c.id, label: c.name })),
]

/** «Город» справочника СТО и АЗС — на странице справочника и в настройках; выбор сразу видят все экраны. */
export function DirectoryCityField({ hint }: { hint?: string }) {
  const city = useDirectoryCity()
  return (
    <Select
      label="Город"
      value={city ?? NO_CITY}
      options={CITY_OPTIONS}
      onChange={(v) => setDirectoryCity(isDirectoryCity(v) ? v : undefined)}
      hint={hint}
    />
  )
}
