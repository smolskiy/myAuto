import { IconFileText, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { useActiveVehicle, useDeadlines, useDocument } from '../../db/hooks'
import { repos } from '../../db/repos'
import { formatDate } from '../../domain/format'
import type { DocumentKind, ID, VehicleDocument } from '../../domain/types'
import { Button, DateField, EmptyState, Select, TextArea, TextField } from '../../ui'
import {
  AttachmentsField,
  FormPage,
  Page,
  useDraftAttachments,
  useGoBack,
  useSoftDelete,
  useToday,
  VehicleGate,
} from '../common'
import { optional } from '../places/links'
import styles from './documents.module.css'
import { daysLeftText, DOCUMENT_KIND_OPTIONS, documentStatus, documentTitle } from './documentStatus'
import { StatusMark } from './StatusMark'

/** Новый документ активной машины (`/documents/new`) или карточка документа с правкой, фото и удалением. */
export default function DocumentPage() {
  const { id } = useParams()
  const doc = useDocument(id)
  if (!id) return <NewDocument />
  if (doc === undefined) return null
  if (doc === null) {
    return (
      <Page title="Документ" back="/documents">
        <EmptyState
          icon={<IconFileText />}
          title="Документ не найден"
          text="Его удалили на этом или другом устройстве."
        />
      </Page>
    )
  }
  return <DocumentForm key={doc.id} doc={doc} vehicleId={doc.vehicleId} />
}

function NewDocument() {
  const { vehicle } = useActiveVehicle()
  if (vehicle === undefined) return null
  if (vehicle === null) {
    return (
      <Page title="Новый документ" back="/documents">
        <VehicleGate>{() => null}</VehicleGate>
      </Page>
    )
  }
  return <DocumentForm vehicleId={vehicle.id} />
}

function DocumentForm({ doc, vehicleId }: { doc?: VehicleDocument; vehicleId: ID }) {
  const today = useToday()
  const draft = useDraftAttachments('document')
  const [kind, setKind] = useState<DocumentKind>(doc?.kind ?? 'osago')
  const [title, setTitle] = useState(doc?.title ?? '')
  const [number, setNumber] = useState(doc?.number ?? '')
  const [issuedAt, setIssuedAt] = useState(doc?.issuedAt ?? '')
  const [validUntil, setValidUntil] = useState(doc?.validUntil ?? '')
  const [note, setNote] = useState(doc?.note ?? '')

  const save = async () => {
    const data = {
      kind,
      title: kind === 'other' ? optional(title) : undefined,
      number: optional(number),
      issuedAt: issuedAt || undefined,
      validUntil: validUntil || undefined,
      note: optional(note),
    }
    if (doc) await repos.documents.update(doc.id, data)
    else await repos.documents.create({ id: draft.ownerId, vehicleId, ...data })
  }

  return (
    <FormPage
      title={doc ? documentTitle(doc) : 'Новый документ'}
      onSave={save}
      onCancel={doc ? undefined : () => void draft.discard()}
    >
      {doc && <Validity doc={doc} today={today} />}
      <Select label="Вид" value={kind} options={DOCUMENT_KIND_OPTIONS} onChange={setKind} />
      {kind === 'other' && (
        <TextField
          label="Название"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Гарантийный талон, пропуск"
        />
      )}
      <TextField
        label="Номер"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
      />
      <div className={styles.dates}>
        <DateField label="Выдан" value={issuedAt} onChange={setIssuedAt} today={today} />
        <DateField label="Действует до" value={validUntil} onChange={setValidUntil} today={today} />
      </div>
      <TextArea label="Заметка" value={note} onChange={(e) => setNote(e.target.value)} />
      <AttachmentsField ownerType="document" ownerId={doc?.id ?? draft.ownerId} label="Фото и сканы" />
      {doc && <DeleteDocument doc={doc} />}
    </FormPage>
  )
}

/** Срок действия сохранённого документа: плашка и сколько осталось. */
function Validity({ doc, today }: { doc: VehicleDocument; today: string }) {
  const deadlines = useDeadlines(doc.vehicleId, today)
  if (!doc.validUntil || !deadlines) return null
  const status = documentStatus(doc, deadlines)
  if (!status) return null
  const left = status.remainingDays !== undefined ? daysLeftText(status.remainingDays) : undefined
  return (
    <section className={styles.validity} aria-label="Срок действия">
      <StatusMark status={status} />
      <span className={styles.validityText}>
        {[`до ${formatDate(doc.validUntil)}`, left].filter(Boolean).join(' · ')}
      </span>
    </section>
  )
}

function DeleteDocument({ doc }: { doc: VehicleDocument }) {
  const goBack = useGoBack()
  const softDelete = useSoftDelete()
  const remove = async () => {
    await softDelete({
      remove: () => repos.documents.remove(doc.id),
      restore: () => repos.documents.restore(doc.id),
      text: 'Документ удалён',
    })
    goBack('/documents')
  }
  return (
    <Button variant="danger" block icon={<IconTrash />} onClick={() => void remove()}>
      Удалить документ
    </Button>
  )
}
