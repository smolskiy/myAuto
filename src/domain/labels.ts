import type { DocumentKind, ExpenseCategory } from './types'

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
