import { IconHistory } from '@tabler/icons-react'
import { useId, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useActiveVehicle, useReminderRule } from '../../db/hooks'
import type { Draft } from '../../db/repo'
import { repos } from '../../db/repos'
import type { CatalogItem, ID, ReminderRule } from '../../domain/types'
import {
  DateField,
  EmptyState,
  Icon,
  ListGroup,
  ListItem,
  NumberField,
  OdometerField,
  SegmentedControl,
  Switch,
  TextArea,
  TextField,
} from '../../ui'
import {
  CatalogItemPicker,
  FormPage,
  Page,
  VehicleGate,
  useGoBack,
  useLookup,
  useSoftDelete,
  useToday,
} from '../common'
import styles from './ReminderRulePage.module.css'

type Mode = 'interval' | 'date'

interface FormState {
  mode: Mode
  itemId?: ID
  title: string
  intervalKm?: number
  intervalMonths?: number
  baselineDate: string
  baselineOdometer?: number
  dueDate: string
  enabled: boolean
  note: string
}

type Errors = Partial<Record<'name' | 'interval' | 'dueDate', string>>

const MODES: { value: Mode; label: string }[] = [
  { value: 'interval', label: 'По интервалу' },
  { value: 'date', label: 'К дате' },
]

function fromRule(rule: ReminderRule): FormState {
  const dateOnly = !!rule.dueDate && !rule.intervalKm && !rule.intervalMonths
  return {
    mode: dateOnly ? 'date' : 'interval',
    itemId: rule.itemId,
    title: rule.title ?? '',
    intervalKm: rule.intervalKm,
    intervalMonths: rule.intervalMonths,
    baselineDate: rule.baseline?.date ?? '',
    baselineOdometer: rule.baseline?.odometer,
    dueDate: rule.dueDate ?? '',
    enabled: rule.enabled,
    note: rule.note ?? '',
  }
}

function fromItem(item: CatalogItem | undefined): FormState {
  return {
    mode: 'interval',
    itemId: item?.id,
    title: '',
    intervalKm: item?.defaultIntervalKm,
    intervalMonths: item?.defaultIntervalMonths,
    baselineDate: '',
    dueDate: '',
    enabled: true,
    note: '',
  }
}

function validate(s: FormState): Errors {
  const errors: Errors = {}
  if (s.mode === 'interval') {
    if (!s.itemId && !s.title.trim()) errors.name = 'Выберите узел или впишите название'
    if (!s.intervalKm && !s.intervalMonths) errors.interval = 'Укажите интервал'
  } else {
    if (!s.title.trim()) errors.name = 'Впишите название'
    if (!s.dueDate) errors.dueDate = 'Укажите дату'
  }
  return errors
}

/**
 * Поля правила для записи в базу. Режим «К дате» — только название и дата (без узла и интервалов);
 * `undefined` у ключа стирает прежнее значение при правке.
 */
function toFields(s: FormState) {
  const note = s.note.trim() || undefined
  if (s.mode === 'date') {
    return {
      itemId: undefined,
      title: s.title.trim(),
      intervalKm: undefined,
      intervalMonths: undefined,
      baseline: undefined,
      dueDate: s.dueDate,
      enabled: s.enabled,
      note,
    }
  }
  const hasBaseline = !!s.baselineDate || s.baselineOdometer !== undefined
  return {
    itemId: s.itemId,
    title: s.title.trim() || undefined,
    intervalKm: s.intervalKm || undefined,
    intervalMonths: s.intervalMonths || undefined,
    baseline: hasBaseline
      ? {
          ...(s.baselineDate && { date: s.baselineDate }),
          ...(s.baselineOdometer !== undefined && { odometer: s.baselineOdometer }),
        }
      : undefined,
    dueDate: undefined,
    enabled: s.enabled,
    note,
  }
}

/** Без ключей со значением undefined — новая строка не хранит пустых полей. */
const compact = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T

function RuleForm({ rule, vehicleId, initial }: { rule?: ReminderRule; vehicleId: ID; initial: FormState }) {
  const today = useToday()
  const navigate = useNavigate()
  const goBack = useGoBack()
  const softDelete = useSoftDelete()
  const baselineHintId = useId()
  const [s, setS] = useState(initial)
  const [errors, setErrors] = useState<Errors>({})

  const patch = (p: Partial<FormState>, clear: (keyof Errors)[] = []) => {
    setS((prev) => ({ ...prev, ...p }))
    if (clear.length > 0)
      setErrors((prev) => ({ ...prev, ...Object.fromEntries(clear.map((k) => [k, undefined])) }))
  }

  const save = async () => {
    const found = validate(s)
    setErrors(found)
    const first = found.name ?? found.interval ?? found.dueDate
    // TODO после слияния оболочки: `return false` — ошибка уже у поля, уведомление не нужно.
    if (first) throw new Error(first)
    const fields = toFields(s)
    if (rule) await repos.reminders.update(rule.id, fields)
    else await repos.reminders.create(compact({ vehicleId, ...fields }) as Draft<ReminderRule>)
  }

  const remove = async () => {
    if (!rule) return
    await softDelete({
      remove: () => repos.reminders.remove(rule.id),
      restore: () => repos.reminders.restore(rule.id),
      text: 'Напоминание удалено',
    })
    goBack('/reminders')
  }

  return (
    <FormPage title={rule ? 'Напоминание' : 'Новое напоминание'} onSave={save}>
      <SegmentedControl
        ariaLabel="Вид напоминания"
        value={s.mode}
        options={MODES}
        onChange={(mode) => {
          patch({ mode })
          setErrors({})
        }}
      />

      {s.mode === 'interval' ? (
        <>
          <CatalogItemPicker
            value={s.itemId}
            onChange={(itemId, item) =>
              patch(
                item
                  ? { itemId, intervalKm: item.defaultIntervalKm, intervalMonths: item.defaultIntervalMonths }
                  : { itemId },
                item ? ['name', 'interval'] : [],
              )
            }
          />
          <TextField
            label="Своё название"
            hint="если узла нет в каталоге"
            value={s.title}
            error={errors.name}
            onChange={(e) => patch({ title: e.target.value }, ['name'])}
          />
          <div className={styles.pair}>
            <NumberField
              label="Каждые … км"
              unit="км"
              decimals={0}
              min={0}
              value={s.intervalKm}
              error={errors.interval}
              onChange={(intervalKm) => patch({ intervalKm }, ['interval'])}
            />
            <NumberField
              label="Каждые … мес."
              unit="мес."
              decimals={0}
              min={0}
              value={s.intervalMonths}
              onChange={(intervalMonths) => patch({ intervalMonths }, ['interval'])}
            />
          </div>
          <fieldset className={styles.group} aria-describedby={baselineHintId}>
            <legend className={styles.legend}>Последний раз</legend>
            <p id={baselineHintId} className={styles.legendHint}>
              если в журнале нет записи
            </p>
            <div className={styles.pair}>
              <DateField
                label="Дата"
                value={s.baselineDate}
                today={today}
                max={today}
                onChange={(baselineDate) => patch({ baselineDate })}
              />
              <OdometerField
                value={s.baselineOdometer}
                onChange={(baselineOdometer) => patch({ baselineOdometer })}
              />
            </div>
          </fieldset>
        </>
      ) : (
        <>
          <TextField
            label="Название"
            required
            value={s.title}
            error={errors.name}
            onChange={(e) => patch({ title: e.target.value }, ['name'])}
          />
          <DateField
            label="Дата"
            value={s.dueDate}
            today={today}
            error={errors.dueDate}
            onChange={(dueDate) => patch({ dueDate }, ['dueDate'])}
          />
        </>
      )}

      <ListGroup>
        <Switch label="Включено" checked={s.enabled} onChange={(enabled) => patch({ enabled })} />
        {s.mode === 'interval' && s.itemId && (
          <ListItem
            title="История узла"
            leading={<Icon icon={IconHistory} tone="accent" circle />}
            chevron
            onClick={() => void navigate(`/items/${s.itemId}`)}
          />
        )}
      </ListGroup>

      <TextArea label="Заметка" value={s.note} onChange={(e) => patch({ note: e.target.value })} />

      {rule && (
        <ListGroup>
          <ListItem title="Удалить" danger onClick={() => void remove()} />
        </ListGroup>
      )}
    </FormPage>
  )
}

function NewRule({ vehicleId }: { vehicleId: ID }) {
  const [params] = useSearchParams()
  const lookup = useLookup()
  if (!lookup) return null
  const itemId = params.get('item')
  const item = itemId ? lookup.catalog.get(itemId) : undefined
  return <RuleForm vehicleId={vehicleId} initial={fromItem(item)} />
}

function EditRule({ id }: { id: ID }) {
  const rule = useReminderRule(id)
  if (rule === undefined) return null
  if (rule === null) {
    return (
      <Page title="Напоминание" back="/reminders">
        <EmptyState title="Напоминание не найдено" text="Возможно, его удалили на другом устройстве." />
      </Page>
    )
  }
  return <RuleForm key={rule.id} rule={rule} vehicleId={rule.vehicleId} initial={fromRule(rule)} />
}

/** Новое правило — для активной машины; машины нет — приглашение добавить (VehicleGate). */
function NewRuleGate() {
  const { vehicle } = useActiveVehicle()
  if (vehicle === undefined) return null
  if (vehicle === null) {
    return (
      <Page title="Новое напоминание" back="/reminders">
        <VehicleGate>{() => null}</VehicleGate>
      </Page>
    )
  }
  return <NewRule vehicleId={vehicle.id} />
}

/** Правило напоминания: `/reminders/new` (можно `?item=<id>`) и `/reminders/:id`. */
export default function ReminderRulePage() {
  const { id } = useParams()
  return id ? <EditRule id={id} /> : <NewRuleGate />
}
