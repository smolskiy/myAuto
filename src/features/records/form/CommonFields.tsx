import { useMemo, useState } from 'react'
import { addDays } from '../../../domain/dates'
import { formatDate, formatKm } from '../../../domain/format'
import { checkOdometer, type OdometerCheck } from '../../../domain/calc/odometer'
import type { CarRecord, ID, ISODate } from '../../../domain/types'
import { Chip, DateField, NumberField } from '../../../ui'
import styles from './RecordForm.module.css'
import { suggestedDate } from './lastDate'
import { changeDate, type RecordForm } from './useRecordForm'

/** Всё, что форме нужно знать вокруг записи: история машины, сегодня, какая строка правится. */
export interface FormContext {
  /** Живые записи машины — для хронологии пробега, подсказок названий и «Повторить прошлое ТО». */
  records: CarRecord[]
  today: ISODate
  currentOdometer: number | null
  /** id правимой записи (исключается из проверки хронологии); у новой — undefined. */
  editingId?: ID
}

export interface FieldsProps {
  form: RecordForm
  ctx: FormContext
}

const WARNING_PREFIX: Record<Exclude<OdometerCheck, { ok: true }>['reason'], string> = {
  lessThanEarlier: 'Раньше',
  greaterThanLater: 'Позже',
  sameDayGap: 'В тот же день',
}

/** «Раньше, 01.02.2026, было 1 500 км» — предупреждение, сохранить можно. */
export function odometerWarning(
  records: CarRecord[],
  candidate: { id?: ID; date: ISODate; odometer?: number },
): string | undefined {
  if (candidate.odometer === undefined || !candidate.date) return undefined
  const check = checkOdometer(records, {
    id: candidate.id,
    date: candidate.date,
    odometer: candidate.odometer,
  })
  if (check.ok) return undefined
  const { date, odometer } = check.conflict
  return `${WARNING_PREFIX[check.reason]}, ${formatDate(date)}, было ${formatKm(odometer)}`
}

/** Дата с быстрыми чипами: «Сегодня», «Вчера» и дата прошлой записи сессии (ввод задним числом). */
export function RecordDateField({ form, ctx, suggest }: FieldsProps & { suggest: boolean }) {
  const { values, errors, update } = form
  const { today } = ctx
  const yesterday = addDays(today, -1)
  // Читаем один раз: дата прошлой записи не меняется, пока открыта форма.
  const [last] = useState(() => (suggest ? suggestedDate(today) : null))
  const pick = (d: ISODate) => update((v) => changeDate(v, d, today))
  return (
    <div className={styles.stack}>
      <DateField
        label="Дата"
        value={values.date}
        onChange={pick}
        today={today}
        max={today}
        error={errors.date}
      />
      <div className={styles.chips} role="group" aria-label="Дата — быстрый выбор">
        <Chip selected={values.date === today} onClick={() => pick(today)}>
          Сегодня
        </Chip>
        <Chip selected={values.date === yesterday} onClick={() => pick(yesterday)}>
          Вчера
        </Chip>
        {last && last !== yesterday && (
          <Chip selected={values.date === last} onClick={() => pick(last)}>
            {`Как в прошлой записи: ${formatDate(last)}`}
          </Chip>
        )}
      </div>
    </div>
  )
}

/**
 * Пробег: подсказка с последним известным и предупреждение о хронологии.
 * NumberField, а не OdometerField из ui: тому не передать ошибку «Укажите пробег».
 */
export function RecordOdometerField({ form, ctx, label = 'Пробег' }: FieldsProps & { label?: string }) {
  const { values, errors, set } = form
  const warning = useMemo(
    () => odometerWarning(ctx.records, { id: ctx.editingId, date: values.date, odometer: values.odometer }),
    [ctx.records, ctx.editingId, values.date, values.odometer],
  )
  return (
    <NumberField
      label={label}
      value={values.odometer}
      onChange={(odometer) => set({ odometer, odometerPrefilled: false })}
      unit="км"
      decimals={0}
      min={0}
      hint={ctx.currentOdometer !== null ? `Последний: ${formatKm(ctx.currentOdometer)}` : undefined}
      error={errors.odometer}
      warning={warning}
    />
  )
}

/** Дата и пробег — общие для всех видов записей. */
export function CommonFields({ form, ctx, suggestDate }: FieldsProps & { suggestDate: boolean }) {
  return (
    <>
      <RecordDateField form={form} ctx={ctx} suggest={suggestDate} />
      <RecordOdometerField form={form} ctx={ctx} />
    </>
  )
}
