import { expect, test } from 'vitest'
import {
  DOCUMENT_KIND_LABELS,
  DRIVE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  FUEL_TYPE_LABELS,
  TRANSMISSION_LABELS,
} from './labels'
import { COST_GROUP_LABELS } from './calc/costs'
import { DOCUMENT_TITLES, EXPENSE_TITLES } from './calc/reminders'
import type { ExpenseCategory } from './types'

test('подписи расходов и документов — из одного источника', () => {
  expect(EXPENSE_TITLES).toBe(EXPENSE_CATEGORY_LABELS)
  expect(DOCUMENT_TITLES).toBe(DOCUMENT_KIND_LABELS)
  for (const [category, label] of Object.entries(EXPENSE_CATEGORY_LABELS)) {
    expect(COST_GROUP_LABELS[category as ExpenseCategory]).toBe(label)
  }
  expect(DOCUMENT_KIND_LABELS.diagCard).toBe('Диагностическая карта')
  expect(EXPENSE_CATEGORY_LABELS.tireStorage).toBe('Хранение шин')
})

test('подписи коробки, привода и топлива — как на экранах', () => {
  expect(TRANSMISSION_LABELS).toEqual({
    mt: 'Механика',
    at: 'Автомат',
    cvt: 'Вариатор',
    amt: 'Робот',
    dct: 'Робот с двумя сцеплениями',
  })
  expect(DRIVE_LABELS).toEqual({ fwd: 'Передний', rwd: 'Задний', awd: 'Полный' })
  expect(FUEL_TYPE_LABELS.diesel).toBe('Дизель')
  expect(FUEL_TYPE_LABELS.lpg).toBe('Газ (пропан)')
})
