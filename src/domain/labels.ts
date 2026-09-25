import type { DocumentKind, Drive, ExpenseCategory, FuelType, Transmission } from './types'

/** Подписи категорий расходов — единственный источник для статистики, сроков, поиска и экранов. */
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  osago: 'ОСАГО',
  kasko: 'КАСКО',
  tax: 'Налог',
  fine: 'Штрафы',
  wash: 'Мойка',
  parking: 'Парковка',
  toll: 'Платные дороги',
  tireService: 'Шиномонтаж',
  tireStorage: 'Хранение шин',
  inspection: 'Техосмотр',
  accessories: 'Аксессуары',
  registration: 'Регистрация',
  other: 'Прочее',
}

/** Подписи видов документов — единственный источник. */
export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  sts: 'СТС',
  pts: 'ПТС',
  osago: 'ОСАГО',
  kasko: 'КАСКО',
  diagCard: 'Диагностическая карта',
  license: 'Водительское удостоверение',
  other: 'Документ',
}

/** Подписи машины — единственный источник для экранов и выгрузки в Excel. */
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
