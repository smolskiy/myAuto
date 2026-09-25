import { expect, test } from 'vitest'
import { DOCUMENT_KIND_LABELS, EXPENSE_CATEGORY_LABELS } from './labels'
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
