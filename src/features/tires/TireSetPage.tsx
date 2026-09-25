import { IconCircleCheck, IconTrash, IconWheel } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  useActiveVehicle,
  useRecords,
  useTireSet,
  useTireSetMileage,
  useTireSets,
  useVehicle,
} from '../../db/hooks'
import { repos } from '../../db/repos'
import { formatKm } from '../../domain/format'
import { formatTireSize, TIRE_BRANDS, tireModels } from '../../domain/tireCatalog'
import type {
  ID,
  Kopecks,
  ServiceRecord,
  TireSeason,
  TireSet,
  TireSetStatus,
  Vehicle,
} from '../../domain/types'
import {
  Button,
  Combobox,
  DateField,
  EmptyState,
  ListGroup,
  MoneyField,
  NumberField,
  RecordRow,
  SegmentedControl,
  Select,
  StatTile,
  Switch,
  TextArea,
  TextField,
  useToast,
} from '../../ui'
import { matches } from '../common/pickerQuery'
import {
  AttachmentsField,
  FormPage,
  Page,
  recordRowProps,
  TIRE_SEASON_LABELS,
  TIRE_STATUS_LABELS,
  TireSizeField,
  useDraftAttachments,
  useGoBack,
  useLookup,
  useSoftDelete,
  useToday,
  VehicleGate,
} from '../common'
import { failureText, optional } from '../garage/kit'
import { formatDot, installTireSet, tireSetTitle } from './tireText'
import styles from './tires.module.css'

const SEASONS = (Object.keys(TIRE_SEASON_LABELS) as TireSeason[]).map((s) => ({
  value: s,
  label: TIRE_SEASON_LABELS[s],
}))
const STATUSES = (Object.keys(TIRE_STATUS_LABELS) as TireSetStatus[]).map((s) => ({
  value: s,
  label: TIRE_STATUS_LABELS[s],
}))

const DOT_ERROR = 'Четыре цифры: неделя и год, например 2423'
const COUNT_ERROR = 'Укажите количество'

/** Новый комплект активной машины (`/tires/new`) или карточка комплекта: пробег, история, правка, установка. */
export default function TireSetPage() {
  const { id } = useParams()
  const set = useTireSet(id)
  if (!id) return <NewTireSet />
  if (set === undefined) return null
  if (set === null) {
    return (
      <Page title="Комплект шин" back="/tires">
        <EmptyState
          icon={<IconWheel />}
          title="Комплект не найден"
          text="Его удалили на этом или другом устройстве."
        />
      </Page>
    )
  }
  return <TireSetForm key={set.id} set={set} vehicleId={set.vehicleId} />
}

function NewTireSet() {
  const { vehicle } = useActiveVehicle()
  if (vehicle === undefined) return null
  if (vehicle === null) {
    return (
      <Page title="Новый комплект" back="/tires">
        <VehicleGate>{() => null}</VehicleGate>
      </Page>
    )
  }
  return <NewTireSetFor vehicle={vehicle} />
}

/** Первый комплект машины — скорее всего тот, что стоит сейчас: предлагаем «Установлены». */
function NewTireSetFor({ vehicle }: { vehicle: Vehicle }) {
  const sets = useTireSets(vehicle.id)
  if (!sets) return null
  const status: TireSetStatus = sets.some((s) => s.status === 'installed') ? 'stored' : 'installed'
  return <TireSetForm vehicleId={vehicle.id} defaults={{ size: vehicle.tireSizeFront, status }} />
}

interface TireSetFormProps {
  set?: TireSet
  vehicleId: ID
  defaults?: { size?: string; status: TireSetStatus }
}

function TireSetForm({ set, vehicleId, defaults }: TireSetFormProps) {
  const today = useToday()
  // Фото нового комплекта — к ownerId черновика; не сохранили — черновик уберёт их сам.
  const draft = useDraftAttachments('tireSet')
  const [season, setSeason] = useState<TireSeason>(set?.season ?? 'summer')
  const [brand, setBrand] = useState(set?.brand ?? '')
  const [model, setModel] = useState(set?.model ?? '')
  const [size, setSize] = useState(set?.size ?? defaults?.size ?? '')
  const [dot, setDot] = useState(set?.dot ?? '')
  const [studded, setStudded] = useState(set?.studded ?? false)
  const [count, setCount] = useState<number | undefined>(set?.count ?? 4)
  const [purchaseDate, setPurchaseDate] = useState(set?.purchaseDate ?? '')
  const [price, setPrice] = useState<Kopecks | undefined>(set?.price)
  const [storage, setStorage] = useState(set?.storage ?? '')
  const [status, setStatus] = useState<TireSetStatus>(set?.status ?? defaults?.status ?? 'stored')
  const [treadMm, setTreadMm] = useState<number | undefined>(set?.treadMm)
  const [note, setNote] = useState(set?.note ?? '')
  const [dotError, setDotError] = useState<string>()
  const [countError, setCountError] = useState<string>()
  const vehicle = useVehicle(vehicleId)

  // Подсказки: бренды — по названию и прежнему имени, модели — выбранного бренда, сначала нужного сезона.
  const brandOptions = TIRE_BRANDS.filter(
    (b) => matches(b.brand, brand) || b.aka?.some((a) => matches(a, brand)),
  ).map((b) => ({ id: b.brand, label: b.brand, hint: b.aka?.join(', ') }))
  const models = tireModels(brand, season)
  // Модель ищется и по прежнему имени: «Nordman 8» найдёт Ikon Character Ice 8.
  const modelOptions = models
    .filter((m) => matches(m.name, model) || m.aka?.some((a) => matches(a, model)))
    .map((m) => ({
      id: m.name,
      label: m.name,
      hint: [
        TIRE_SEASON_LABELS[m.season],
        m.studded ? 'шипы' : m.season === 'winter' ? 'без шипов' : '',
        m.aka ? `раньше ${m.aka.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(', '),
    }))
  const pickModel = (name: string) => {
    setModel(name)
    const m = models.find((x) => x.name === name)
    if (!m) return
    // Модель знает свой сезон и шипы — подставляем, владелец может поправить.
    setSeason(m.season)
    if (m.season === 'winter' && m.studded !== undefined) setStudded(m.studded)
  }

  const dotText = formatDot(dot)

  const save = async (): Promise<false | void> => {
    const badDot = !!dot.trim() && !dotText
    // Стёртое количество — не «4 по умолчанию»: владелец мог иметь в виду 2 колеса.
    const noCount = count === undefined || count < 1
    if (badDot) setDotError(DOT_ERROR)
    if (noCount) setCountError(COUNT_ERROR)
    if (badDot || noCount) return false
    const data = {
      season,
      brand: optional(brand),
      model: optional(model),
      size: optional(formatTireSize(size)),
      dot: optional(dot),
      studded: season === 'summer' ? undefined : studded,
      count: Math.round(count),
      purchaseDate: purchaseDate || undefined,
      price,
      storage: optional(storage),
      status,
      treadMm,
      note: optional(note),
    }
    const id = set?.id ?? draft.ownerId
    const write = () =>
      set ? repos.tireSets.update(set.id, data) : repos.tireSets.create({ id, vehicleId, ...data })
    if (status === 'installed') await installTireSet({ id, vehicleId }, write)
    else await write()
  }

  return (
    <FormPage title={set ? tireSetTitle(set) : 'Новый комплект'} onSave={save}>
      {set && <TireSetSummary set={set} onInstalled={() => setStatus('installed')} />}
      <div className={styles.labelled}>
        <span className={styles.fieldLabel} aria-hidden="true">
          Сезон
        </span>
        <SegmentedControl ariaLabel="Сезон" value={season} options={SEASONS} onChange={setSeason} />
      </div>
      <Combobox
        label="Бренд"
        value={brandOptions.find((o) => o.label === brand) ?? null}
        options={brandOptions}
        query={brand}
        onQueryChange={setBrand}
        onSelect={(o) => o && setBrand(o.label)}
      />
      <Combobox
        label="Модель"
        value={modelOptions.find((o) => o.label === model) ?? null}
        options={modelOptions}
        query={model}
        onQueryChange={setModel}
        onSelect={(o) => o && pickModel(o.label)}
        hint={brand && models.length === 0 ? 'Моделей этого бренда в подсказках нет — впишите' : undefined}
      />
      <div className={styles.pair}>
        <TireSizeField
          label="Размер"
          value={size}
          onChange={setSize}
          preferred={[vehicle?.tireSizeFront ?? '', vehicle?.tireSizeRear ?? '']}
          placeholder="205/55 R16"
        />
        <TextField
          label="DOT"
          value={dot}
          onChange={(e) => {
            setDot(e.target.value.replace(/\D/g, '').slice(0, 4))
            if (dotError) setDotError(undefined)
          }}
          inputMode="numeric"
          placeholder="2423"
          autoComplete="off"
          hint={dotText}
          error={dotError}
        />
      </div>
      {season !== 'summer' && (
        <ListGroup>
          <Switch label="Шипы" checked={studded} onChange={setStudded} />
        </ListGroup>
      )}
      <div className={styles.pair}>
        <NumberField
          label="Количество"
          value={count}
          onChange={(v) => {
            setCount(v)
            if (countError) setCountError(undefined)
          }}
          decimals={0}
          min={1}
          unit="шт"
          error={countError}
        />
        <NumberField
          label="Остаток протектора"
          value={treadMm}
          onChange={setTreadMm}
          decimals={1}
          min={0}
          unit="мм"
        />
      </div>
      <Select label="Состояние" value={status} options={STATUSES} onChange={setStatus} />
      <TextField
        label="Где хранятся"
        value={storage}
        onChange={(e) => setStorage(e.target.value)}
        placeholder="Гараж, шинный отель"
      />
      <div className={styles.pair}>
        <DateField
          label="Куплены"
          value={purchaseDate}
          onChange={setPurchaseDate}
          today={today}
          max={today}
        />
        <MoneyField label="Цена" value={price} onChange={setPrice} />
      </div>
      <TextArea label="Заметка" value={note} onChange={(e) => setNote(e.target.value)} />
      <AttachmentsField ownerType="tireSet" ownerId={set?.id ?? draft.ownerId} label="Фото" />
      {set && <TireSetExtras set={set} />}
    </FormPage>
  )
}

/** Пробег комплекта и «Отметить установленным» — первым, ради них карточку и открывают. */
function TireSetSummary({ set, onInstalled }: { set: TireSet; onInstalled(): void }) {
  const toast = useToast()
  const mileage = useTireSetMileage(set.id)
  const install = async () => {
    try {
      const stored = await installTireSet(set)
      onInstalled()
      toast.show({ text: stored > 0 ? 'Комплект установлен, прежний — на хранении' : 'Комплект установлен' })
    } catch (e) {
      toast.show({ text: failureText(e) })
    }
  }
  return (
    <section className={styles.summary} aria-label="Комплект">
      <StatTile
        label="Пробег комплекта"
        value={mileage !== undefined ? formatKm(mileage) : '—'}
        hint={TIRE_STATUS_LABELS[set.status]}
        tone={set.status === 'installed' ? 'accent' : 'neutral'}
      />
      {set.status !== 'installed' && (
        <Button variant="secondary" block icon={<IconCircleCheck />} onClick={() => void install()}>
          Отметить установленным
        </Button>
      )}
    </section>
  )
}

/** История смен шин с этим комплектом и удаление. */
function TireSetExtras({ set }: { set: TireSet }) {
  const navigate = useNavigate()
  const goBack = useGoBack()
  const softDelete = useSoftDelete()
  const lookup = useLookup()
  const records = useRecords(set.vehicleId, { kinds: ['service'] })
  const swaps = (records ?? []).filter(
    (r): r is ServiceRecord =>
      r.kind === 'service' && (r.tireSwap?.mountedSetId === set.id || r.tireSwap?.removedSetId === set.id),
  )

  const remove = async () => {
    await softDelete({
      remove: () => repos.tireSets.remove(set.id),
      restore: () => repos.tireSets.restore(set.id),
      text: 'Комплект удалён',
    })
    goBack('/tires')
  }

  return (
    <>
      {swaps.length > 0 && (
        <ListGroup title="История">
          {swaps.map((r) => {
            const row = recordRowProps(r, lookup, { onClick: () => void navigate(`/record/${r.id}`) })
            const what = r.tireSwap?.mountedSetId === set.id ? 'Установлены' : 'Сняты'
            return (
              <RecordRow
                key={r.id}
                {...row}
                subtitle={[what, r.odometer !== undefined ? formatKm(r.odometer) : undefined]
                  .filter(Boolean)
                  .join(' · ')}
              />
            )
          })}
        </ListGroup>
      )}
      <Button variant="danger" block icon={<IconTrash />} onClick={() => void remove()}>
        Удалить комплект
      </Button>
    </>
  )
}
