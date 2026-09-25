import { IconFileOff } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import NotFoundPage from '../../app/NotFoundPage'
import { useCurrentOdometer, useRecord, useRecords } from '../../db/hooks'
import type { CarRecord, ID, RecordKind, Vehicle } from '../../domain/types'
import { EmptyState, TextArea } from '../../ui'
import {
  AttachmentsField,
  FormPage,
  Page,
  RECORD_KIND_LABELS,
  useDraftAttachments,
  useToday,
  VehicleGate,
} from '../common'
import { CommonFields, type FormContext } from './form/CommonFields'
import { ExpenseFields } from './form/ExpenseFields'
import { FuelFields } from './form/FuelFields'
import { rememberDate } from './form/lastDate'
import { saveRecord } from './form/saveRecord'
import { NoteFields } from './form/NoteFields'
import { ServiceFields } from './form/ServiceFields'
import {
  copyRecordValues,
  newRecordValues,
  recordToValues,
  toDraft,
  useRecordForm,
  validate,
  type RecordFormValues,
} from './form/useRecordForm'

const KINDS = Object.keys(RECORD_KIND_LABELS) as RecordKind[]
const isKind = (k: string | undefined): k is RecordKind => KINDS.includes(k as RecordKind)

interface RecordFormProps {
  title: string
  /** Начальные значения — вызывается один раз, при появлении формы. */
  initial(): RecordFormValues
  ctx: FormContext
  /** id записи: новой — id черновика вложений, правимой — её id. */
  recordId: ID
  /** Новая (и копия «Повторить») — создаётся по «Сохранить»; правка — обновляется. */
  mode: 'new' | 'edit'
  onCancel?(): void
}

/** Форма записи любого вида: поля вида, заметка, фото и «Сохранить» внизу. */
function RecordForm({ title, initial, ctx, recordId, mode, onCancel }: RecordFormProps) {
  const form = useRecordForm(initial)
  const { values, set } = form
  const [focusInvalid, setFocusInvalid] = useState(0)

  // Не прошла проверка — фокус на первое поле с ошибкой: оно может быть выше экрана.
  useEffect(() => {
    if (focusInvalid) document.querySelector<HTMLElement>('main [aria-invalid="true"]')?.focus()
  }, [focusInvalid])

  const onSave = async (): Promise<string | void | false> => {
    const errors = validate(values)
    if (Object.keys(errors).length > 0) {
      form.setErrors(errors)
      setFocusInvalid((n) => n + 1)
      // Ошибки у полей, фокус на первой: форма остаётся без уведомления.
      return false
    }
    const draft = toDraft(values)
    await saveRecord(draft, recordId, mode === 'new' ? 'create' : 'update')
    rememberDate(draft.date)
    // Новая запись заменяется своей карточкой; правка возвращается туда, откуда пришли.
    if (mode === 'new') return `/record/${recordId}`
  }

  const fields = { form, ctx, suggestDate: mode === 'new' }
  return (
    <FormPage title={title} onSave={onSave} onCancel={onCancel}>
      {values.kind === 'service' && <ServiceFields {...fields} />}
      {values.kind === 'fuel' && <FuelFields {...fields} />}
      {values.kind === 'expense' && <ExpenseFields {...fields} />}
      {values.kind === 'note' && <NoteFields {...fields} />}
      {values.kind === 'odometer' && <CommonFields {...fields} />}
      {values.kind !== 'note' && (
        <TextArea
          label="Заметка"
          value={values.note}
          rows={2}
          onChange={(e) => set({ note: e.target.value })}
        />
      )}
      <AttachmentsField ownerType="record" ownerId={recordId} />
    </FormPage>
  )
}

/**
 * Новая запись: форма появляется, когда известны история машины и текущий пробег. С `source` — копия
 * («Повторить»): поля предзаполнены из записи-источника, в базу ничего не пишется до «Сохранить».
 */
function NewRecord({
  kind,
  vehicle,
  source,
}: {
  kind: RecordKind
  vehicle: Pick<Vehicle, 'id' | 'defaultFuelGrade'>
  source?: CarRecord
}) {
  const records = useRecords(vehicle.id)
  const currentOdometer = useCurrentOdometer(vehicle.id)
  const today = useToday()
  const drafts = useDraftAttachments('record')
  if (records === undefined || currentOdometer === undefined) return null
  return (
    <RecordForm
      title={source ? 'Копия записи' : RECORD_KIND_LABELS[kind]}
      initial={() =>
        source ? copyRecordValues(source, today) : newRecordValues(kind, vehicle, { today, currentOdometer })
      }
      ctx={{ records, today, currentOdometer }}
      recordId={drafts.ownerId}
      mode="new"
      onCancel={() => void drafts.discard()}
    />
  )
}

function NewActiveRecord({ kind }: { kind: RecordKind }) {
  return <VehicleGate>{(v) => <NewRecord key={`${kind}:${v.id}`} kind={kind} vehicle={v} />}</VehicleGate>
}

/** `/record/new/:kind?from=<id>` — копия записи; источника нет (удалён) — обычная новая запись. */
function CopyRecord({ kind, fromId }: { kind: RecordKind; fromId: ID }) {
  const source = useRecord(fromId)
  if (source === undefined) return null
  if (source === null || source.kind !== kind) return <NewActiveRecord kind={kind} />
  return <NewRecord kind={kind} vehicle={{ id: source.vehicleId }} source={source} />
}

function EditLoaded({ record }: { record: CarRecord }) {
  const records = useRecords(record.vehicleId)
  const currentOdometer = useCurrentOdometer(record.vehicleId)
  const today = useToday()
  if (records === undefined || currentOdometer === undefined) return null
  return (
    <RecordForm
      title="Правка записи"
      initial={() => recordToValues(record)}
      ctx={{ records, today, currentOdometer, editingId: record.id }}
      recordId={record.id}
      mode="edit"
    />
  )
}

function EditRecord({ id }: { id: ID }) {
  const record = useRecord(id)
  if (record === undefined) return null
  if (record === null) {
    return (
      <Page title="Правка записи" back>
        <EmptyState
          icon={<IconFileOff />}
          title="Запись не найдена"
          text="Её удалили или она ещё не пришла с Диска."
        />
      </Page>
    )
  }
  // Ключ — id: живой запрос отдаёт новые копии той же записи, форму они не пересоздают.
  return <EditLoaded key={record.id} record={record} />
}

/** `/record/new/:kind` (с `?from=<id>` — копия записи), `/record/:id/edit`. */
export default function RecordFormPage() {
  const { kind, id } = useParams()
  const [params] = useSearchParams()
  const from = params.get('from')
  if (id) return <EditRecord key={id} id={id} />
  if (!isKind(kind)) return <NotFoundPage />
  if (from) return <CopyRecord key={`${kind}:${from}`} kind={kind} fromId={from} />
  return <NewActiveRecord kind={kind} />
}
