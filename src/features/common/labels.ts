/**
 * Подписи перечислений для экранов. Категории расходов, виды документов и группы каталога — единый источник
 * в domain (их же используют статистика, сроки и поиск), здесь только реэкспорт.
 */
import type {
  Drive,
  FluidKind,
  FuelType,
  PartUnit,
  PlaceKind,
  RecordKind,
  ServiceType,
  TireSeason,
  TireSetStatus,
  Transmission,
} from '../../domain/types'

export { DOCUMENT_KIND_LABELS, EXPENSE_CATEGORY_LABELS } from '../../domain/labels'
export { ITEM_GROUP_LABELS } from '../../domain/catalog'

/** Порядок ключей — порядок в выборе типа записи. */
export const RECORD_KIND_LABELS: Record<RecordKind, string> = {
  service: 'ТО и ремонт',
  fuel: 'Заправка',
  expense: 'Расход',
  odometer: 'Пробег',
  note: 'Заметка',
}

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  maintenance: 'ТО',
  repair: 'Ремонт',
  diagnostics: 'Диагностика',
  bodywork: 'Кузов',
  tires: 'Шины',
  tuning: 'Тюнинг',
  other: 'Другое',
}

export const PLACE_KIND_LABELS: Record<PlaceKind, string> = {
  service: 'СТО',
  fuel: 'АЗС',
  parts: 'Магазин запчастей',
  wash: 'Мойка',
  tire: 'Шиномонтаж',
  insurance: 'Страховая',
  other: 'Другое',
}

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  petrol: 'Бензин',
  diesel: 'Дизель',
  hybrid: 'Гибрид',
  electric: 'Электро',
  lpg: 'Газ (пропан)',
  cng: 'Газ (метан)',
}

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  mt: 'Механика',
  at: 'Автомат',
  cvt: 'Вариатор',
  amt: 'Робот',
  dct: 'Робот с двумя сцеплениями',
}

export const DRIVE_LABELS: Record<Drive, string> = {
  fwd: 'Передний',
  rwd: 'Задний',
  awd: 'Полный',
}

export const FLUID_KIND_LABELS: Record<FluidKind, string> = {
  engineOil: 'Моторное масло',
  coolant: 'Охлаждающая жидкость',
  atf: 'Масло АКПП',
  mtf: 'Масло МКПП',
  brake: 'Тормозная жидкость',
  powerSteering: 'Жидкость ГУР',
  diffFront: 'Масло переднего редуктора',
  diffRear: 'Масло заднего редуктора',
  transferCase: 'Масло раздаточной коробки',
}

export const UNIT_LABELS: Record<PartUnit, string> = {
  pcs: 'шт',
  l: 'л',
  set: 'компл.',
  m: 'м',
  kg: 'кг',
}

export const TIRE_SEASON_LABELS: Record<TireSeason, string> = {
  summer: 'Летние',
  winter: 'Зимние',
  allSeason: 'Всесезонные',
}

export const TIRE_STATUS_LABELS: Record<TireSetStatus, string> = {
  installed: 'Установлены',
  stored: 'На хранении',
  retired: 'Списаны',
}
