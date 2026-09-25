import { IconFileText, IconPlus } from '@tabler/icons-react'
import { useNavigate } from 'react-router'
import { useAttachments, useDeadlines, useDocuments } from '../../db/hooks'
import type { DeadlineStatus } from '../../domain/calc/reminders'
import { formatDate, formatNumber, NBSP, pluralize } from '../../domain/format'
import type { Vehicle, VehicleDocument } from '../../domain/types'
import { Button, EmptyState, ListGroup, ListItem } from '../../ui'
import { Page, useToday, VehicleGate } from '../common'
import { SubtitleLines } from '../garage/RowText'
import { documentStatus, documentTitle } from './documentStatus'
import { StatusMark } from './StatusMark'

const FILE_FORMS: [string, string, string] = ['файл', 'файла', 'файлов']

function DocumentRow({
  doc,
  deadlines,
  onOpen,
}: {
  doc: VehicleDocument
  deadlines: DeadlineStatus[] | undefined
  onOpen(): void
}) {
  const files = useAttachments('document', doc.id)?.length ?? 0
  const status = deadlines ? documentStatus(doc, deadlines) : undefined
  const details = [
    doc.number?.trim(),
    files > 0 ? `${formatNumber(files)}${NBSP}${pluralize(files, FILE_FORMS)}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ')
  // Срок с плашкой — первой строкой под названием: справа плашка отнимала место у названия и даты.
  const validity = doc.validUntil ? (
    <>
      {status && <StatusMark status={status} />} до {formatDate(doc.validUntil)}
    </>
  ) : undefined
  return (
    <ListItem
      title={documentTitle(doc)}
      subtitle={<SubtitleLines lines={[validity, details]} />}
      chevron
      onClick={onOpen}
    />
  )
}

function DocumentsList({ vehicle }: { vehicle: Vehicle }) {
  const navigate = useNavigate()
  const today = useToday()
  const docs = useDocuments(vehicle.id)
  const deadlines = useDeadlines(vehicle.id, today)
  if (!docs) return null
  const add = (
    <Button variant="secondary" block icon={<IconPlus />} onClick={() => void navigate('/documents/new')}>
      Добавить документ
    </Button>
  )
  if (docs.length === 0) {
    return (
      <EmptyState
        icon={<IconFileText />}
        title="Документов пока нет"
        text="СТС, ПТС, полисы и диагностическая карта — с фото и сроками действия."
        action={add}
      />
    )
  }
  return (
    <>
      <ListGroup title={vehicle.name} footer="«Скоро» — за 30 дней до конца срока.">
        {docs.map((d) => (
          <DocumentRow
            key={d.id}
            doc={d}
            deadlines={deadlines}
            onOpen={() => void navigate(`/documents/${d.id}`)}
          />
        ))}
      </ListGroup>
      {add}
    </>
  )
}

/** Документы активной машины: сроки со статусом и число вложений. */
export default function DocumentsPage() {
  return (
    <Page title="Документы" back="/more">
      <VehicleGate>{(vehicle) => <DocumentsList vehicle={vehicle} />}</VehicleGate>
    </Page>
  )
}
