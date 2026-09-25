import { IconFileOff } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import NotFoundPage from '../../app/NotFoundPage'
import { useCurrentOdometer, useRecord, useRecords } from '../../db/hooks'
import { repos } from '../../db/repos'
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
import { rememberDate } from './form/lastDate'
import { NoteFields } from './form/NoteFields'
import {
  newRecordValues,
  recordToValues,
  toDraft,
  useRecordForm,
  validate,
  type RecordFormValues,
} from './form/useRecordForm'

const KINDS = Object.keys(RECORD_KIND_LABELS) as RecordKind[]
const isKind = (k: string | undefined): k is RecordKind => KINDS.includes(k as RecordKind)

/** Текст уведомления, когда форма не прошла проверку: сами ошибки — у полей. */
const INVALID = 'Заполните отмеченные поля'

interface RecordFormProps {
  title: string
  initial: RecordFormValues
  ctx: FormContext
  /** id записи: новой — id черновика вложений, правимой — её id. */
  recordId: ID
  isNew: boolean
  onCancel?(): void
}

/** Форма записи любого вида: поля вида, заметка, фото и «Сохранить» внизу. */
function RecordForm({ title, initial, ctx, recordId, isNew, onCancel }: RecordFormProps) {
  const form = useRecordForm(initial)
  const { values, set } = form
  const [focusInvalid, setFocusInvalid] = useState(0)

  // Не прошла проверка — фокус на первое поле с ошибкой: оно может быть выше экрана.
  useEffect(() => {
    if (focusInvalid) document.querySelector<HTMLElement>('main [aria-invalid="true"]')?.focus()
  }, [focusInvalid])

  const onSave = async (): Promise<string | void> => {
    const errors = validate(values)
    if (Object.keys(errors).length > 0) {
      form.setErrors(errors)
      setFocusInvalid((n) => n + 1)
      throw new Error(INVALID)
    }
    const draft = toDraft(values)
    if (isNew) await repos.records.create({ ...draft, id: recordId })
    else await repos.records.update(recordId, draft)
    rememberDate(draft.date)
    if (isNew) return `/record/${recordId}`
  }

  const fields = { form, ctx, suggestDate: isNew }
  return (
    <FormPage title={title} onSave={onSave} onCancel={onCancel}>
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

/** Новая запись активной машины: форма появляется, когда известны история и текущий пробег. */
function NewRecord({ kind, vehicle }: { kind: RecordKind; vehicle: Vehicle }) {
  const records = useRecords(vehicle.id)
  const currentOdometer = useCurrentOdometer(vehicle.id)
  const today = useToday()
  const drafts = useDraftAttachments('record')
  if (records === undefined || currentOdometer === undefined) return null
  return (
    <RecordForm
      title={RECORD_KIND_LABELS[kind]}
      initial={newRecordValues(kind, vehicle, { today, currentOdometer })}
      ctx={{ records, today, currentOdometer }}
      recordId={drafts.ownerId}
      isNew
      onCancel={() => void drafts.discard()}
    />
  )
}

function EditLoaded({ record }: { record: CarRecord }) {
  const records = useRecords(record.vehicleId)
  const currentOdometer = useCurrentOdometer(record.vehicleId)
  const today = useToday()
  if (records === undefined || currentOdometer === undefined) return null
  return (
    <RecordForm
      title="Правка записи"
      initial={recordToValues(record)}
      ctx={{ records, today, currentOdometer, editingId: record.id }}
      recordId={record.id}
      isNew={false}
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

/** `/record/new/:kind` и `/record/:id/edit`. */
export default function RecordFormPage() {
  const { kind, id } = useParams()
  if (id) return <EditRecord key={id} id={id} />
  if (!isKind(kind)) return <NotFoundPage />
  return <VehicleGate>{(v) => <NewRecord key={`${kind}:${v.id}`} kind={kind} vehicle={v} />}</VehicleGate>
}
