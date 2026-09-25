import {
  IconFileOff,
  IconHammer,
  IconMapPin,
  IconPencil,
  IconRepeat,
  IconTrash,
  IconUser,
} from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useFuelStats, useRecord, useTireSets } from '../../db/hooks'
import { repos } from '../../db/repos'
import { lineTotal } from '../../domain/calc/lines'
import { formatConsumption, formatDate, formatKm, formatLiters, formatMoney } from '../../domain/format'
import type { CarRecord, ExpenseRecord, FuelRecord, ServiceRecord, TireSet } from '../../domain/types'
import { Dialog, EmptyState, Icon, IconButton, ListGroup, ListItem } from '../../ui'
import {
  AttachmentsField,
  EXPENSE_CATEGORY_LABELS,
  MISSING_PLACE,
  Page,
  RECORD_KIND_ICON,
  RECORD_KIND_LABELS,
  recordTitle,
  SERVICE_TYPE_LABELS,
  TIRE_SEASON_LABELS,
  useGoBack,
  useLookup,
  useSoftDelete,
  type Lookup,
} from '../common'
import { linesTotal } from './form/serviceTotals'
import { partMeta } from './lineText'
import { DOC_NUMBER_LABEL } from './labels'
import styles from './RecordPage.module.css'
import { useRepeatRecord } from './repeat'

const HAS_AMOUNT = new Set(['service', 'fuel', 'expense'])

/** Шапка: значок вида, название, дата и пробег, крупно — сумма (у пробега — сам пробег). */
function Hero({ r }: { r: CarRecord }) {
  const Glyph = RECORD_KIND_ICON[r.kind]
  const amount = HAS_AMOUNT.has(r.kind) ? formatMoney(r.total) : undefined
  const big = amount ?? (r.kind === 'odometer' && r.odometer !== undefined ? formatKm(r.odometer) : undefined)
  const showKm = r.odometer !== undefined && r.kind !== 'odometer'
  return (
    <header className={styles.hero}>
      <div className={styles.heroTop}>
        <Icon icon={Glyph} tone={r.kind} size={24} circle />
        <div className={styles.heroText}>
          <h2 className={styles.heroTitle}>{recordTitle(r)}</h2>
          <p className={styles.heroMeta}>
            <span>{formatDate(r.date, 'long')}</span>
            {showKm && <span>{formatKm(r.odometer!)}</span>}
          </p>
        </div>
      </div>
      {big && <p className={styles.amount}>{big}</p>}
    </header>
  )
}

/** Где и кто: место, мастер, «Делал сам» — строки-ссылки на свои карточки. */
function WhereRows({ r, lookup }: { r: CarRecord; lookup: Lookup | undefined }) {
  const navigate = useNavigate()
  const service = r.kind === 'service' ? r : null
  const place = r.placeId ? lookup?.places.get(r.placeId) : undefined
  const master = service?.masterId ? lookup?.masters.get(service.masterId) : undefined
  const rows = []
  if (r.placeId && lookup) {
    rows.push(
      <ListItem
        key="place"
        leading={<Icon icon={IconMapPin} tone="accent" circle />}
        title={place?.name ?? MISSING_PLACE}
        subtitle={place?.address}
        chevron={!!place}
        onClick={place ? () => void navigate(`/places/${place.id}`) : undefined}
      />,
    )
  }
  if (service?.masterId && lookup) {
    rows.push(
      <ListItem
        key="master"
        leading={<Icon icon={IconUser} tone="accent" circle />}
        title={master?.name ?? 'Мастер удалён'}
        subtitle={master?.specialization ?? 'Мастер'}
        chevron={!!master}
        onClick={master ? () => void navigate(`/masters/${master.id}`) : undefined}
      />,
    )
  }
  if (service?.diy) {
    rows.push(<ListItem key="diy" leading={<Icon icon={IconHammer} circle />} title="Делал сам" />)
  }
  return rows.length > 0 ? <ListGroup>{rows}</ListGroup> : null
}

const tireLabel = (sets: TireSet[] | undefined, id?: string) => {
  const s = id ? sets?.find((x) => x.id === id) : undefined
  if (!id) return undefined
  if (!s) return 'Комплект удалён'
  return [TIRE_SEASON_LABELS[s.season], s.brand, s.model].filter(Boolean).join(' ')
}

function ServiceDetails({ r, lookup }: { r: ServiceRecord; lookup: Lookup | undefined }) {
  const tireSets = useTireSets(r.tireSwap ? r.vehicleId : undefined)
  const byLines = linesTotal(r.works, r.parts)
  const hasLines = r.works.length > 0 || r.parts.length > 0
  const mounted = tireLabel(tireSets, r.tireSwap?.mountedSetId)
  const removed = tireLabel(tireSets, r.tireSwap?.removedSetId)
  return (
    <>
      {r.works.length > 0 && (
        <ListGroup title="Работы">
          {r.works.map((w) => (
            <ListItem
              key={w.id}
              title={w.name}
              subtitle={w.masterId ? lookup?.masters.get(w.masterId)?.name : undefined}
              value={w.price !== undefined ? formatMoney(w.price) : undefined}
            />
          ))}
        </ListGroup>
      )}
      {r.parts.length > 0 && (
        <ListGroup title="Запчасти">
          {r.parts.map((p) => (
            <ListItem
              key={p.id}
              title={p.name}
              subtitle={partMeta(p)}
              value={p.unitPrice !== undefined ? formatMoney(lineTotal(p)) : undefined}
            />
          ))}
        </ListGroup>
      )}
      <ListGroup>
        <ListItem title="Тип работ" value={SERVICE_TYPE_LABELS[r.serviceType]} />
        <ListItem title="Итого" value={formatMoney(r.total)} />
        {hasLines && byLines !== r.total && <ListItem title="По строкам" value={formatMoney(byLines)} />}
        {r.warrantyUntilDate && <ListItem title="Гарантия до" value={formatDate(r.warrantyUntilDate)} />}
        {r.warrantyUntilKm !== undefined && (
          <ListItem title="Гарантия до пробега" value={formatKm(r.warrantyUntilKm)} />
        )}
        {mounted && <ListItem title="Установлен комплект" value={mounted} />}
        {removed && <ListItem title="Снят комплект" value={removed} />}
      </ListGroup>
    </>
  )
}

function FuelDetails({ r }: { r: FuelRecord }) {
  const stats = useFuelStats(r.vehicleId)
  const interval = stats?.intervals.find((i) => i.toId === r.id)
  return (
    <ListGroup>
      {interval && (
        <ListItem
          title="Расход"
          subtitle="с прошлого полного бака"
          value={formatConsumption(interval.lPer100km)}
        />
      )}
      <ListItem title="Литры" value={formatLiters(r.liters)} />
      <ListItem title="Цена за литр" value={formatMoney(r.pricePerLiter)} />
      <ListItem title="Полный бак" value={r.fullTank ? 'Да' : 'Нет'} />
      {r.missedBefore && <ListItem title="Пропустил заправку перед этой" value="Да" />}
      {r.fuelGrade && <ListItem title="Марка топлива" value={r.fuelGrade} />}
    </ListGroup>
  )
}

function ExpenseDetails({ r }: { r: ExpenseRecord }) {
  const validity =
    r.validFrom && r.validUntil
      ? `${formatDate(r.validFrom)} — ${formatDate(r.validUntil)}`
      : r.validUntil
        ? `до ${formatDate(r.validUntil)}`
        : r.validFrom
          ? `с ${formatDate(r.validFrom)}`
          : undefined
  return (
    <ListGroup>
      <ListItem title="Категория" value={EXPENSE_CATEGORY_LABELS[r.category]} />
      {validity && <ListItem title="Действует" value={validity} />}
      {r.docNumber && <ListItem title={DOC_NUMBER_LABEL[r.category] ?? 'Номер'} value={r.docNumber} />}
    </ListGroup>
  )
}

function RecordDetails({ r }: { r: CarRecord }) {
  const navigate = useNavigate()
  const goBack = useGoBack()
  const lookup = useLookup()
  const softDelete = useSoftDelete()
  const repeat = useRepeatRecord()
  const [confirming, setConfirming] = useState(false)

  const remove = () => {
    setConfirming(false)
    // Сначала уходим: иначе карточка на миг покажет «Запись не найдена».
    goBack('/journal')
    void softDelete({
      remove: () => repos.records.remove(r.id),
      restore: () => repos.records.restore(r.id),
      text: 'Запись удалена',
    })
  }

  return (
    <Page
      title={RECORD_KIND_LABELS[r.kind]}
      back="/journal"
      actions={
        <IconButton
          label="Изменить"
          icon={<IconPencil />}
          onClick={() => void navigate(`/record/${r.id}/edit`)}
        />
      }
    >
      <Hero r={r} />
      <WhereRows r={r} lookup={lookup} />
      {r.kind === 'service' && <ServiceDetails r={r} lookup={lookup} />}
      {r.kind === 'fuel' && <FuelDetails r={r} />}
      {r.kind === 'expense' && <ExpenseDetails r={r} />}
      {r.note?.trim() && (
        <ListGroup title={r.kind === 'note' ? 'Текст' : 'Заметка'}>
          <p className={styles.note}>{r.note}</p>
        </ListGroup>
      )}
      <AttachmentsField ownerType="record" ownerId={r.id} />
      <ListGroup>
        <ListItem
          leading={<Icon icon={IconRepeat} tone="accent" circle />}
          title="Повторить"
          onClick={() => repeat(r)}
        />
        <ListItem
          leading={<Icon icon={IconTrash} tone="overdue" circle />}
          title="Удалить"
          danger
          onClick={() => setConfirming(true)}
        />
      </ListGroup>
      <Dialog
        open={confirming}
        title="Удалить запись?"
        text="Она пропадёт из журнала и статистики."
        confirmLabel="Удалить"
        danger
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </Page>
  )
}

/** `/record/:id` — карточка записи. */
export default function RecordPage() {
  const { id } = useParams()
  const record = useRecord(id)
  if (record === undefined) return null
  if (record === null) {
    return (
      <Page title="Запись" back="/journal">
        <EmptyState
          icon={<IconFileOff />}
          title="Запись не найдена"
          text="Её удалили или она ещё не пришла с Диска."
        />
      </Page>
    )
  }
  return <RecordDetails key={record.id} r={record} />
}
