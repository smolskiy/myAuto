import type { ExpenseCategory, PlaceKind } from '../../../domain/types'
import { DateField, MoneyField, Select, TextField } from '../../../ui'
import { EXPENSE_CATEGORY_LABELS, PLACE_KIND_LABELS, PlacePicker } from '../../common'
import { DOC_NUMBER_LABEL } from '../labels'
import { CommonFields, type FieldsProps } from './CommonFields'
import styles from './RecordForm.module.css'
import { VALIDITY_CATEGORIES } from './useRecordForm'

const CATEGORY_OPTIONS = (Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((value) => ({
  value,
  label: EXPENSE_CATEGORY_LABELS[value],
}))

const ALL_PLACE_KINDS = Object.keys(PLACE_KIND_LABELS) as PlaceKind[]

/** Каким видом создаётся новое место из расхода; предлагаются места всех видов. */
const PLACE_KIND_BY_CATEGORY: Partial<Record<ExpenseCategory, PlaceKind>> = {
  osago: 'insurance',
  kasko: 'insurance',
  wash: 'wash',
  tireService: 'tire',
  tireStorage: 'tire',
  inspection: 'service',
  accessories: 'parts',
}

function placeKinds(category: ExpenseCategory): PlaceKind[] {
  const primary = PLACE_KIND_BY_CATEGORY[category] ?? 'other'
  return [primary, ...ALL_PLACE_KINDS.filter((k) => k !== primary)]
}

/** Расход: категория и сумма первыми, срок действия — у полисов и диагностической карты. */
export function ExpenseFields({ form, ctx, suggestDate }: FieldsProps & { suggestDate: boolean }) {
  const { values, errors, set } = form
  const validity = VALIDITY_CATEGORIES.has(values.category)
  return (
    <>
      <Select
        label="Категория"
        value={values.category}
        options={CATEGORY_OPTIONS}
        onChange={(category) => set({ category })}
      />
      <MoneyField
        label="Сумма"
        value={values.total}
        onChange={(total) => set({ total })}
        error={errors.total}
      />
      <CommonFields form={form} ctx={ctx} suggestDate={suggestDate} />
      <PlacePicker
        label="Место"
        kinds={placeKinds(values.category)}
        value={values.placeId}
        onChange={(placeId) => set({ placeId })}
      />
      <TextField
        label="Название"
        value={values.title}
        placeholder={EXPENSE_CATEGORY_LABELS[values.category]}
        onChange={(e) => set({ title: e.target.value })}
      />
      {validity && (
        <>
          <div className={styles.pair}>
            <DateField
              label="Действует с"
              value={values.validFrom}
              onChange={(validFrom) => set({ validFrom })}
              today={ctx.today}
            />
            <DateField
              label="Действует до"
              value={values.validUntil}
              onChange={(validUntil) => set({ validUntil })}
              today={ctx.today}
              error={errors.validUntil}
            />
          </div>
          <TextField
            label={DOC_NUMBER_LABEL[values.category] ?? 'Номер'}
            value={values.docNumber}
            autoCapitalize="characters"
            onChange={(e) => set({ docNumber: e.target.value })}
          />
        </>
      )}
    </>
  )
}
