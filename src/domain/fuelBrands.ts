/**
 * Сети АЗС юга России (Ростовская область, Краснодарский и Ставропольский края, Волгоград, Астрахань, Адыгея,
 * Калмыкия) и Крыма — подсказки поля «АЗС». Отбор — по числу заправок сети в поиске Яндекс Карт по 21 городу
 * (2026-09-26); сеть с одной-двумя заправками в одном городе — не сюда, а в справочник города.
 */

export type FuelRegion = 'south' | 'crimea' | 'both'

export interface FuelBrand {
  /** Как пишет сама сеть. */
  name: string
  /** Другие написания и прежние имена — для поиска. */
  aka?: string[]
  region: FuelRegion
}

/** Самые распространённые — первыми. */
export const FUEL_BRANDS: FuelBrand[] = [
  { name: 'Лукойл', aka: ['Lukoil', 'Лукоил'], region: 'south' },
  { name: 'Роснефть', aka: ['Rosneft', 'ТНК', 'TNK'], region: 'south' },
  { name: 'АТАН', aka: ['ATAN'], region: 'crimea' },
  { name: 'Газпром', aka: ['Gazprom', 'АГНКС', 'Газпром газомоторное топливо'], region: 'south' },
  { name: 'Газпромнефть', aka: ['Газпром нефть', 'Gazpromneft', 'ГПН'], region: 'south' },
  { name: 'ТЭС', aka: ['TES'], region: 'crimea' },
  { name: 'Teboil', aka: ['Тебойл', 'Shell', 'Шелл'], region: 'south' },
  { name: 'Eco Oil', aka: ['EcoOil', 'Эко Ойл', 'ЭкоОйл'], region: 'south' },
  { name: 'Flash', aka: ['Флеш', 'Флэш'], region: 'south' },
  { name: 'Rusoil', aka: ['Русойл'], region: 'south' },
  { name: 'Октан', aka: ['Oktan'], region: 'south' },
  { name: 'Эксон Ойл', aka: ['Exon Oil'], region: 'south' },
  { name: 'Формула', aka: ['Formula'], region: 'both' },
  { name: 'Grifon', aka: ['Грифон'], region: 'crimea' },
  { name: 'Южная нефтяная компания', aka: ['ЮНК'], region: 'south' },
  { name: 'Кобарт', aka: ['Kobart'], region: 'south' },
  { name: 'RedPetrol', aka: ['Red Petrol', 'Ред Петрол'], region: 'crimea' },
  { name: 'НТК', aka: ['NTK'], region: 'south' },
  { name: 'Татнефть', aka: ['Tatneft'], region: 'south' },
  { name: 'Веста', aka: ['Vesta'], region: 'crimea' },
  { name: 'Мустанг', aka: ['Mustang'], region: 'crimea' },
  { name: 'Старт', aka: ['Start'], region: 'crimea' },
  { name: 'Ставнефть', region: 'south' },
  { name: 'Опти', aka: ['Opti'], region: 'south' },
  { name: 'Гранд', aka: ['Grand'], region: 'south' },
  { name: 'Новатэк', aka: ['Novatek'], region: 'south' },
  { name: 'Кавказ-Автогаз', aka: ['Kavkaz Autogas'], region: 'south' },
]

const REGION_TEXT: Record<FuelRegion, string> = {
  south: 'юг России',
  crimea: 'Крым',
  both: 'юг России и Крым',
}

/** «Сеть АЗС · Крым» — подпись подсказки. */
export const fuelBrandHint = (b: FuelBrand) => `Сеть АЗС · ${REGION_TEXT[b.region]}`

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[\s-]+/g, ' ')

/** Сети, в названии или другом написании которых есть набранное. Пустой запрос — ничего. */
export function searchFuelBrands(query: string): FuelBrand[] {
  const q = norm(query)
  if (!q) return []
  return FUEL_BRANDS.filter((b) => [b.name, ...(b.aka ?? [])].some((n) => norm(n).includes(q)))
}
