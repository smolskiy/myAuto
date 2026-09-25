import type { ExpenseCategory } from '../../domain/types'

/** Подсказки марки топлива: форма заправки и «Топливо на АЗС» у машины. */
export const FUEL_GRADES = ['АИ-92', 'АИ-95', 'АИ-98', 'ДТ', 'Газ']

/** Подпись номера у расходов со сроком действия: форма расхода и карточка записи. */
export const DOC_NUMBER_LABEL: Partial<Record<ExpenseCategory, string>> = {
  osago: 'Номер полиса',
  kasko: 'Номер полиса',
  inspection: 'Номер диагностической карты',
}
