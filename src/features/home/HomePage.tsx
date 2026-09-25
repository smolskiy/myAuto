import { IconGasStation, IconGauge, IconNotes, IconReceipt, IconTool } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import {
  useActiveVehicle,
  useAttachments,
  useCostBreakdown,
  useCurrentOdometer,
  useFuelStats,
  useRecords,
  useUpcoming,
  useVehicles,
} from '../../db/hooks'
import { addDays } from '../../domain/dates'
import { formatConsumption, formatKm, formatMoney } from '../../domain/format'
import type { RecordKind, Vehicle } from '../../domain/types'
import { syncEngine } from '../../sync/index'
import { useAttachmentUrl, useSyncStatus } from '../../sync/react'
import {
  Button,
  Card,
  EmptyState,
  Icon,
  ListGroup,
  PullToRefresh,
  RecordRow,
  ReminderCard,
  SectionHeader,
  StatTile,
  SyncStatusBadge,
  VehicleCard,
  VehicleSwitcher,
} from '../../ui'
import { Page, VehicleGate, recordRowProps, useLookup, useToday } from '../common'
import { agoText } from '../settings/syncText'
import { useNow } from '../settings/useNow'
import { periodRange } from '../stats/periods'
import styles from './HomePage.module.css'
import { reminderCardProps } from './reminderText'

/** «Потрачено в сентябре» — месяц в предложном падеже. */
const MONTHS_PREPOSITIONAL = [
  'январе',
  'феврале',
  'марте',
  'апреле',
  'мае',
  'июне',
  'июле',
  'августе',
  'сентябре',
  'октябре',
  'ноябре',
  'декабре',
]

const QUICK: { kind: RecordKind; label: string; icon: typeof IconTool }[] = [
  { kind: 'fuel', label: 'Заправка', icon: IconGasStation },
  { kind: 'service', label: 'ТО', icon: IconTool },
  { kind: 'expense', label: 'Расход', icon: IconReceipt },
  { kind: 'odometer', label: 'Пробег', icon: IconGauge },
]

const RECENT_LIMIT = 5
const UPCOMING_LIMIT = 3
const FUEL_WINDOW_DAYS = 90

const vehicleSubtitle = (v: Vehicle) =>
  [v.make, v.model, v.year].filter((p) => p !== undefined && p !== '').join(' ')

function useVehiclePhoto(vehicle: Vehicle): string | null | undefined {
  const attachments = useAttachments('vehicle', vehicle.photoAttachmentId ? vehicle.id : undefined)
  const photo = attachments?.find((a) => a.id === vehicle.photoAttachmentId)
  return useAttachmentUrl(photo, 'thumb')
}

function HomeContent({ vehicle }: { vehicle: Vehicle }) {
  const navigate = useNavigate()
  const today = useToday()
  const { setActive } = useActiveVehicle()
  const vehicles = useVehicles()
  const odometer = useCurrentOdometer(vehicle.id)
  const photoUrl = useVehiclePhoto(vehicle)
  const upcoming = useUpcoming(vehicle.id, UPCOMING_LIMIT, today)
  const records = useRecords(vehicle.id)
  const lookup = useLookup()
  // Тот же месяц, что «Месяц» в статистике, — числа на главной и в статистике совпадают.
  const costs = useCostBreakdown(vehicle.id, periodRange('month', today))
  const fuel = useFuelStats(vehicle.id, { from: addDays(today, -FUEL_WINDOW_DAYS), to: today })
  const [switching, setSwitching] = useState(false)

  const go = (path: string) => void navigate(path)
  const monthName = MONTHS_PREPOSITIONAL[Number(today.slice(5, 7)) - 1]

  return (
    <div className={styles.stack}>
      <VehicleCard
        name={vehicle.name}
        subtitle={vehicleSubtitle(vehicle) || undefined}
        plate={vehicle.plate}
        odometer={odometer != null ? formatKm(odometer) : undefined}
        photoUrl={photoUrl}
        onSwitch={() => setSwitching(true)}
      />
      <VehicleSwitcher
        open={switching}
        onClose={() => setSwitching(false)}
        vehicles={(vehicles ?? []).map((v) => ({
          id: v.id,
          name: v.name,
          subtitle: vehicleSubtitle(v) || undefined,
        }))}
        activeId={vehicle.id}
        onSelect={(id) => void setActive(id)}
        onAdd={() => go('/vehicle/new')}
        onGarage={() => go('/garage')}
      />

      <nav className={styles.quick} aria-label="Быстрая запись">
        {QUICK.map((q) => (
          <button
            key={q.kind}
            type="button"
            className={styles.quickAction}
            onClick={() => go(`/record/new/${q.kind}`)}
          >
            <Icon icon={q.icon} tone={q.kind} circle />
            {q.label}
          </button>
        ))}
      </nav>

      {upcoming && (
        <section aria-label="Скоро">
          <SectionHeader
            title="Скоро"
            action={upcoming.length > 0 ? { label: 'Все', onClick: () => go('/reminders') } : undefined}
          />
          {upcoming.length > 0 ? (
            <ListGroup>
              {upcoming.map((item) => (
                <ReminderCard
                  key={item.key}
                  compact
                  {...reminderCardProps(item, today)}
                  onClick={() => go('/reminders')}
                />
              ))}
            </ListGroup>
          ) : (
            <Card padded className={styles.emptyRow}>
              <span className={styles.emptyText}>
                <span className={styles.emptyTitle}>Напоминаний нет</span>
                <span className={styles.emptyHint}>Масло, фильтры, страховка — напомним заранее</span>
              </span>
              <Button size="sm" variant="secondary" onClick={() => go('/reminders/new')}>
                Настроить
              </Button>
            </Card>
          )}
        </section>
      )}

      {records && records.length > 0 && (
        <div className={styles.tiles}>
          <StatTile
            label={`Потрачено в ${monthName}`}
            value={costs ? formatMoney(costs.total) : '—'}
            onClick={() => go('/stats')}
          />
          <StatTile
            label="Расход топлива"
            value={fuel?.average != null ? formatConsumption(fuel.average) : '—'}
            hint={`за ${FUEL_WINDOW_DAYS} дней`}
            onClick={() => go('/stats')}
          />
        </div>
      )}

      {records && (
        <section aria-label="Последние записи">
          <SectionHeader
            title="Последние записи"
            action={records.length > 0 ? { label: 'Весь журнал', onClick: () => go('/journal') } : undefined}
          />
          {records.length > 0 ? (
            <ListGroup>
              {records.slice(0, RECENT_LIMIT).map((r) => (
                <RecordRow
                  key={r.id}
                  {...recordRowProps(r, lookup, { onClick: () => go(`/record/${r.id}`) })}
                />
              ))}
            </ListGroup>
          ) : (
            <Card>
              <EmptyState
                icon={<IconNotes />}
                title="Записей пока нет"
                text="Внесите последнее ТО или заправку — появятся сводка и напоминания."
                action={<Button onClick={() => go('/record/new/service')}>Внести ТО</Button>}
              />
            </Card>
          )}
        </section>
      )}
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const status = useSyncStatus()
  const now = useNow()
  return (
    <Page
      title="Мой авто"
      large
      actions={
        <SyncStatusBadge
          state={status.state}
          lastSyncText={status.lastSyncAt ? agoText(status.lastSyncAt, now) : undefined}
          // `pending` значка подписан «Не отправлено изменений», а статус знает только число ждущих фото —
          // не передаём; «Ждут загрузки: N фото» — на экране «Синхронизация».
          onClick={() => void navigate('/settings/sync')}
        />
      }
    >
      <PullToRefresh onRefresh={() => syncEngine.syncNow('pull')} disabled={status.state === 'off'}>
        <VehicleGate>{(vehicle) => <HomeContent vehicle={vehicle} />}</VehicleGate>
      </PullToRefresh>
    </Page>
  )
}
