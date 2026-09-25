import {
  IconArchive,
  IconArchiveOff,
  IconChartBar,
  IconCircleCheck,
  IconFileText,
  IconList,
  IconPencil,
  IconWheel,
} from '@tabler/icons-react'
import { useNavigate, useParams } from 'react-router'
import {
  useActiveVehicle,
  useCostBreakdown,
  useCurrentOdometer,
  useRecords,
  useVehicle,
} from '../../db/hooks'
import { repos } from '../../db/repos'
import { formatDate, formatKm, formatNumber, NBSP, pluralize } from '../../domain/format'
import type { Vehicle } from '../../domain/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  ListGroup,
  ListItem,
  RecordRow,
  VehicleCard,
  useToast,
} from '../../ui'
import { Page, recordRowProps, useLookup } from '../common'
import { failureText } from '../garage/kit'
import { OwnershipList } from './details/OwnershipList'
import { FluidsList, SpecsList } from './details/SpecsList'
import { useVehiclePhoto } from './details/useVehiclePhoto'
import { makeModelYear, shownOdometer } from './details/vehicleText'
import styles from './details/VehiclePage.module.css'

const RECENT = 3
const RECORD_FORMS: [string, string, string] = ['запись', 'записи', 'записей']

/** Карточка машины: фото и паспорт, владение и расходы, архив, переходы в разделы машины. */
export default function VehiclePage() {
  const { id } = useParams()
  const vehicle = useVehicle(id)
  if (vehicle === undefined) return <Page title="Машина" back="/garage" />
  if (vehicle === null) {
    return (
      <Page title="Машина" back="/garage">
        <EmptyState title="Машина не найдена" text="Её удалили или она ещё не пришла с другого устройства." />
      </Page>
    )
  }
  return <VehicleDetails vehicle={vehicle} />
}

function VehicleDetails({ vehicle }: { vehicle: Vehicle }) {
  const navigate = useNavigate()
  const toast = useToast()
  const lookup = useLookup()
  const { vehicle: active, setActive } = useActiveVehicle()
  const odometer = shownOdometer(vehicle, useCurrentOdometer(vehicle.id))
  const records = useRecords(vehicle.id)
  const costs = useCostBreakdown(vehicle.id)
  const photo = useVehiclePhoto(vehicle)

  const isActive = active?.id === vehicle.id

  const run = (action: () => Promise<void>) => {
    action().catch((e: unknown) => toast.show({ text: failureText(e) }))
  }

  const archive = () =>
    run(async () => {
      await repos.vehicles.update(vehicle.id, { archived: true })
      if (!isActive) return
      // Активная ушла в архив — активной становится первая неархивная по порядку.
      const next = (await repos.vehicles.list())
        .filter((v) => !v.archived && v.id !== vehicle.id)
        .sort((a, b) => a.order - b.order)[0]
      if (next) await setActive(next.id)
    })

  const unarchive = () => run(() => repos.vehicles.update(vehicle.id, { archived: false }).then(() => {}))

  /** Разделы «Журнал», «Документы»… показывают активную машину: сначала делаем активной эту. */
  const openSection = (path: string) =>
    run(async () => {
      if (!isActive) await setActive(vehicle.id)
      await navigate(path)
    })

  const status = vehicle.archived ? (
    <Badge>{vehicle.sale?.date ? `Продана ${formatDate(vehicle.sale.date)}` : 'В архиве'}</Badge>
  ) : isActive ? (
    <Badge tone="accent">Активная</Badge>
  ) : null

  const count = records?.length ?? 0

  return (
    <Page
      title={vehicle.name}
      back="/garage"
      actions={
        <IconButton
          label="Изменить"
          icon={<IconPencil />}
          onClick={() => void navigate(`/vehicle/${vehicle.id}/edit`)}
        />
      }
    >
      <section className={styles.hero} aria-label="Машина">
        <VehicleCard
          name={vehicle.name}
          subtitle={makeModelYear(vehicle) || undefined}
          plate={vehicle.plate?.trim() || undefined}
          odometer={odometer !== undefined ? formatKm(odometer) : undefined}
          photoUrl={photo}
        />
        <div className={styles.state}>
          {status}
          {/* Пока неизвестно, какая машина активна, действий нет: «В архив» должно знать, передавать ли активность. */}
          {active !== undefined && (
            <div className={styles.actions}>
              {!vehicle.archived && !isActive && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<IconCircleCheck />}
                  onClick={() => run(() => setActive(vehicle.id))}
                >
                  Сделать активной
                </Button>
              )}
              {vehicle.archived ? (
                <Button variant="secondary" size="sm" icon={<IconArchiveOff />} onClick={unarchive}>
                  Вернуть из архива
                </Button>
              ) : (
                <Button variant="secondary" size="sm" icon={<IconArchive />} onClick={archive}>
                  В архив
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      <ListGroup title="Разделы">
        <ListItem
          leading={<Icon icon={IconList} tone="accent" circle />}
          title="Журнал"
          value={records ? `${formatNumber(count)}${NBSP}${pluralize(count, RECORD_FORMS)}` : undefined}
          chevron
          onClick={() => openSection('/journal')}
        />
        <ListItem
          leading={<Icon icon={IconChartBar} tone="accent" circle />}
          title="Статистика"
          chevron
          onClick={() => openSection('/stats')}
        />
        <ListItem
          leading={<Icon icon={IconFileText} tone="accent" circle />}
          title="Документы"
          chevron
          onClick={() => openSection('/documents')}
        />
        <ListItem
          leading={<Icon icon={IconWheel} tone="accent" circle />}
          title="Шины"
          chevron
          onClick={() => openSection('/tires')}
        />
      </ListGroup>

      {records && records.length > 0 && (
        <ListGroup title="Последние записи">
          {records.slice(0, RECENT).map((r) => (
            <RecordRow
              key={r.id}
              {...recordRowProps(r, lookup, { onClick: () => void navigate(`/record/${r.id}`) })}
            />
          ))}
        </ListGroup>
      )}

      {records && costs && <OwnershipList vehicle={vehicle} records={records} expenses={costs.total} />}

      <SpecsList vehicle={vehicle} />
      <FluidsList vehicle={vehicle} />

      {vehicle.note?.trim() && (
        <Card padded>
          <p className={styles.note}>{vehicle.note}</p>
        </Card>
      )}
    </Page>
  )
}
