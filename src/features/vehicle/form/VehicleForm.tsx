import { useEffect, useId, useState, type ReactNode } from 'react'
import { useActiveVehicle, useAttachments } from '../../../db/hooks'
import { repos } from '../../../db/repos'
import type { Drive, FuelType, ID, Transmission, Vehicle } from '../../../domain/types'
import {
  Combobox,
  DateField,
  MoneyField,
  NumberField,
  SchematicPicker,
  Select,
  TextArea,
  TextField,
} from '../../../ui'
import {
  AttachmentsField,
  DRIVE_LABELS,
  FormPage,
  FUEL_TYPE_LABELS,
  TireSizeField,
  TRANSMISSION_LABELS,
  useDraftAttachments,
  useToday,
} from '../../common'
import { FUEL_GRADES } from '../../records/labels'
import { schematicChoice, schematicOptions, schematicValue } from '../schematicChoice'
import { BODY_LABELS } from '../../../domain/carCatalog'
import { carPickerOptions } from './carPicker'
import { FluidsEditor } from './FluidsEditor'
import { useCarCatalog } from './useCarCatalog'
import styles from './VehicleForm.module.css'
import {
  applyVin,
  defaultName,
  validateVehicle,
  valuesToDraft,
  vehicleToValues,
  type VehicleErrors,
  type VehicleValues,
} from './vehicleValues'
import { VinField } from './VinField'

export interface VehicleFormProps {
  /** Правимая машина; без неё — новая. */
  initial?: Vehicle
  /**
   * Машина сохранена. Возврат уходит в FormPage: путь — заменить форму этим экраном, ничего — «назад»,
   * `false` — остаться (онбординг сам переключает шаг).
   */
  onSaved(v: Vehicle): string | void | false
  /** По умолчанию «Сохранить». */
  submitLabel?: string
  /** Заголовок экрана; по умолчанию «Новая машина» / «Правка машины». */
  title?: string
  /** Вступление над полями (онбординг: шаг и пояснение). */
  intro?: ReactNode
  /** Значок кнопки сохранения (FormPage): по умолчанию дискета, `null` — без значка. */
  saveIcon?: ReactNode | null
  /** Без «Назад» в шапке (первый шаг онбординга). */
  backHidden?: boolean
}

const NONE = 'none'
const options = <T extends string>(labels: Record<T, string>) => [
  { value: NONE, label: 'Не указано' },
  ...(Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] })),
]
const FUEL_OPTIONS = options<FuelType>(FUEL_TYPE_LABELS)
const TRANSMISSION_OPTIONS = options<Transmission>(TRANSMISSION_LABELS)
const DRIVE_OPTIONS = options<Drive>(DRIVE_LABELS)
const fromNone = <T extends string>(v: string) => (v === NONE ? undefined : (v as T))

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {children}
    </section>
  )
}

/**
 * Форма машины: VIN с расшифровкой, марка и модель, двигатель, покупка и продажа, жидкости, шины, фото.
 * Новая машина встаёт последней в гараже и становится активной. Страницы `/vehicle/new`, `/vehicle/:id/edit`
 * и первый шаг онбординга.
 */
export function VehicleForm({
  initial,
  onSaved,
  submitLabel,
  title,
  intro,
  saveIcon,
  backHidden,
}: VehicleFormProps) {
  const today = useToday()
  const { setActive } = useActiveVehicle()
  const drafts = useDraftAttachments('vehicle')
  const ownerId: ID = initial?.id ?? drafts.ownerId
  const photos = useAttachments('vehicle', ownerId)
  const [values, setValues] = useState<VehicleValues>(() => vehicleToValues(initial))
  const [errors, setErrors] = useState<VehicleErrors>({})
  const [focusInvalid, setFocusInvalid] = useState(0)
  const cars = useCarCatalog()

  const set = (patch: Partial<VehicleValues>) => {
    setValues((v) => ({ ...v, ...patch }))
    setErrors((e) => {
      const next = { ...e }
      for (const key of Object.keys(patch) as (keyof VehicleValues)[]) delete next[key]
      return next
    })
  }

  useEffect(() => {
    if (focusInvalid) document.querySelector<HTMLElement>('main [aria-invalid="true"]')?.focus()
  }, [focusInvalid])

  const onSave = async (): Promise<string | void | false> => {
    const found = validateVehicle(values, today)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      setFocusInvalid((n) => n + 1)
      return false
    }
    // Главное фото: прежнее, если его не удалили, иначе первое фото машины.
    const live = (photos ?? []).filter((a) => a.kind === 'photo')
    const photoAttachmentId = live.some((a) => a.id === initial?.photoAttachmentId)
      ? initial?.photoAttachmentId
      : live[0]?.id
    const order = initial ? initial.order : await repos.vehicles.nextOrder()
    const draft = valuesToDraft(values, initial, { order, photoAttachmentId })
    const saved = initial
      ? await repos.vehicles.update(initial.id, draft)
      : await repos.vehicles.create({ ...draft, id: ownerId })
    if (!initial) await setActive(saved.id)
    return onSaved(saved)
  }

  const pick = carPickerOptions(cars, values)
  // Поколение из справочника: кузов подставляем, только если он у поколения один и поле пустое.
  const pickGeneration = (name: string) => {
    const bodies = pick.generation(name)?.bodies ?? []
    set(
      !values.bodyType.trim() && bodies.length === 1
        ? { generation: name, bodyType: BODY_LABELS[bodies[0]!] }
        : { generation: name },
    )
  }

  const q = values.defaultFuelGrade.trim().toLowerCase()
  const grades = FUEL_GRADES.filter((g) => !q || g.toLowerCase().includes(q)).map((g) => ({
    id: g,
    label: g,
  }))

  return (
    <FormPage
      title={title ?? (initial ? 'Правка машины' : 'Новая машина')}
      saveLabel={submitLabel}
      saveIcon={saveIcon}
      backHidden={backHidden}
      onSave={onSave}
      onCancel={initial ? undefined : () => void drafts.discard()}
    >
      {intro}
      <VinField
        value={values.vin}
        onChange={(vin) => set({ vin })}
        onApply={(info) => set(applyVin(values, info))}
      />
      <Combobox
        label="Марка"
        value={pick.makeOptions.find((o) => o.label === values.make) ?? null}
        options={pick.makeOptions}
        query={values.make}
        onQueryChange={(make) => set({ make })}
        onSelect={(o) => o && set({ make: o.label })}
        error={errors.make}
      />
      <Combobox
        label="Модель"
        value={pick.modelOptions.find((o) => o.label === values.model) ?? null}
        options={pick.modelOptions}
        query={values.model}
        onQueryChange={(model) => set({ model })}
        onSelect={(o) => o && set({ model: o.label })}
        error={errors.model}
      />
      <TextField
        label="Название"
        value={values.name}
        placeholder={defaultName(values) || 'Как её зовёте'}
        hint="Как машина подписана в гараже и на главной"
        onChange={(e) => set({ name: e.target.value })}
      />
      <div className={styles.pair}>
        <TextField
          label="Год"
          value={values.year}
          inputMode="numeric"
          maxLength={4}
          onChange={(e) => set({ year: e.target.value.replace(/\D/g, '') })}
          error={errors.year}
        />
        <TextField
          label="Госномер"
          value={values.plate}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => set({ plate: e.target.value.toUpperCase() })}
        />
      </div>
      <Combobox
        label="Поколение"
        value={pick.generationOptions.find((o) => o.label === values.generation) ?? null}
        options={pick.generationOptions}
        query={values.generation}
        onQueryChange={(generation) => set({ generation })}
        onSelect={(o) => o && pickGeneration(o.label)}
        placeholder="A7, рестайлинг"
      />
      <div className={styles.pair}>
        <TextField label="Цвет" value={values.color} onChange={(e) => set({ color: e.target.value })} />
        <Combobox
          label="Кузов"
          value={pick.bodyOptions.find((o) => o.label === values.bodyType) ?? null}
          options={pick.bodyOptions}
          query={values.bodyType}
          onQueryChange={(bodyType) => set({ bodyType })}
          onSelect={(o) => o && set({ bodyType: o.label })}
          placeholder="Лифтбек"
        />
      </div>
      <SchematicPicker
        label="Картинка на главной"
        value={schematicChoice(values.schematic || undefined)}
        options={schematicOptions({
          make: values.make,
          model: values.model,
          year: values.year ? Number(values.year) : undefined,
          generation: values.generation,
          bodyType: values.bodyType,
        })}
        onChange={(choice) => set({ schematic: schematicValue(choice) ?? '' })}
      />

      <Section title="Двигатель и трансмиссия">
        <Select
          label="Топливо"
          value={values.fuel ?? NONE}
          options={FUEL_OPTIONS}
          onChange={(v) => set({ fuel: fromNone<FuelType>(v) })}
        />
        <div className={styles.pair}>
          <NumberField
            label="Объём"
            unit="см³"
            value={values.displacementCc}
            onChange={(displacementCc) => set({ displacementCc })}
          />
          <NumberField
            label="Мощность"
            unit="л. с."
            value={values.powerHp}
            onChange={(powerHp) => set({ powerHp })}
          />
        </div>
        <TextField
          label="Код двигателя"
          value={values.engineCode}
          autoCapitalize="characters"
          spellCheck={false}
          onChange={(e) => set({ engineCode: e.target.value })}
        />
        <Select
          label="Коробка передач"
          value={values.transmission ?? NONE}
          options={TRANSMISSION_OPTIONS}
          onChange={(v) => set({ transmission: fromNone<Transmission>(v) })}
        />
        <Select
          label="Привод"
          value={values.drive ?? NONE}
          options={DRIVE_OPTIONS}
          onChange={(v) => set({ drive: fromNone<Drive>(v) })}
        />
        <div className={styles.pair}>
          <NumberField
            label="Объём бака"
            unit="л"
            value={values.tankLiters}
            onChange={(tankLiters) => set({ tankLiters })}
          />
          <Combobox
            label="Топливо на АЗС"
            value={grades.find((g) => g.label === values.defaultFuelGrade) ?? null}
            options={grades}
            query={values.defaultFuelGrade}
            onQueryChange={(defaultFuelGrade) => set({ defaultFuelGrade })}
            onSelect={(o) => o && set({ defaultFuelGrade: o.label })}
          />
        </div>
      </Section>

      <Section title="Шины">
        <div className={styles.pair}>
          <TireSizeField
            label="Размер спереди"
            value={values.tireSizeFront}
            placeholder="205/55 R16"
            onChange={(tireSizeFront) => set({ tireSizeFront })}
          />
          <TireSizeField
            label="Размер сзади"
            value={values.tireSizeRear}
            placeholder="Как спереди"
            preferred={[values.tireSizeFront]}
            onChange={(tireSizeRear) => set({ tireSizeRear })}
          />
        </div>
      </Section>

      <FluidsEditor value={values.fluids} onChange={(fluids) => set({ fluids })} />

      <Section title="Покупка">
        <DateField
          label="Дата покупки"
          value={values.purchaseDate}
          onChange={(purchaseDate) => set({ purchaseDate })}
          today={today}
          max={today}
          error={errors.purchaseDate}
        />
        <NumberField
          label="Пробег при покупке"
          unit="км"
          value={values.purchaseOdometer}
          onChange={(purchaseOdometer) => set({ purchaseOdometer })}
        />
        <MoneyField
          label="Цена покупки"
          value={values.purchasePrice}
          onChange={(purchasePrice) => set({ purchasePrice })}
        />
      </Section>

      <Section title="Продажа">
        <DateField
          label="Дата продажи"
          value={values.saleDate}
          onChange={(saleDate) => set({ saleDate })}
          today={today}
          max={today}
          hint={values.saleDate ? 'Машина уйдёт в архив' : undefined}
          error={errors.saleDate}
        />
        {values.saleDate && (
          <>
            <NumberField
              label="Пробег при продаже"
              unit="км"
              value={values.saleOdometer}
              onChange={(saleOdometer) => set({ saleOdometer })}
            />
            <MoneyField
              label="Цена продажи"
              value={values.salePrice}
              onChange={(salePrice) => set({ salePrice })}
            />
          </>
        )}
      </Section>

      <AttachmentsField ownerType="vehicle" ownerId={ownerId} label="Фото машины" />
      <TextArea
        label="Заметка"
        value={values.note}
        rows={2}
        onChange={(e) => set({ note: e.target.value })}
      />
    </FormPage>
  )
}
