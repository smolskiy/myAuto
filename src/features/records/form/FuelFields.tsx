import { toKopecks, toRubles } from '../../../domain/money'
import { Combobox, ListGroup, MoneyField, NumberField, Switch } from '../../../ui'
import { PlacePicker } from '../../common'
import { CommonFields, type FieldsProps } from './CommonFields'
import styles from './RecordForm.module.css'
import { editFuel, type FuelField } from './useRecordForm'

const GRADES = ['АИ-92', 'АИ-95', 'АИ-98', 'ДТ', 'Газ']

/** Заправка: литры, цена за литр и сумма — любые два считают третье; полный бак, марка топлива, АЗС. */
export function FuelFields({ form, ctx, suggestDate }: FieldsProps & { suggestDate: boolean }) {
  const { values, errors, set, update } = form
  const edit = (field: FuelField, value: number | undefined) => update((v) => editFuel(v, field, value))

  const q = values.fuelGrade.trim().toLowerCase()
  const grades = GRADES.filter((g) => !q || g.toLowerCase().includes(q)).map((g) => ({ id: g, label: g }))

  return (
    <>
      <CommonFields form={form} ctx={ctx} suggestDate={suggestDate} />
      <div className={styles.pair}>
        <NumberField
          label="Литры"
          value={values.liters}
          onChange={(v) => edit('liters', v)}
          unit="л"
          decimals={2}
          min={0}
          error={errors.liters}
        />
        <NumberField
          label="Цена за литр"
          value={values.pricePerLiter === undefined ? undefined : toRubles(values.pricePerLiter)}
          onChange={(v) => edit('pricePerLiter', v === undefined ? undefined : toKopecks(v))}
          unit="₽"
          decimals={2}
          min={0}
          error={errors.pricePerLiter}
        />
      </div>
      <MoneyField
        label="Сумма"
        value={values.total}
        onChange={(v) => edit('total', v)}
        hint="Любые два поля из трёх — третье посчитается"
      />
      <ListGroup>
        <Switch label="Полный бак" checked={values.fullTank} onChange={(fullTank) => set({ fullTank })} />
        <Switch
          label="Пропустил заправку перед этой"
          hint="Расход до этой заправки не считается"
          checked={values.missedBefore}
          onChange={(missedBefore) => set({ missedBefore })}
        />
      </ListGroup>
      <Combobox
        label="Марка топлива"
        value={grades.find((g) => g.label === values.fuelGrade) ?? null}
        options={grades}
        query={values.fuelGrade}
        onQueryChange={(fuelGrade) => set({ fuelGrade })}
        onSelect={(o) => o && set({ fuelGrade: o.label })}
      />
      <PlacePicker
        label="АЗС"
        kinds={['fuel']}
        value={values.placeId}
        onChange={(placeId) => set({ placeId })}
      />
    </>
  )
}
