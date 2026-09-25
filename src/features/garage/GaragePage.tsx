import { IconCar, IconPlus } from '@tabler/icons-react'
import { useNavigate } from 'react-router'
import { useActiveVehicle, useCurrentOdometer, useVehicles } from '../../db/hooks'
import { formatKm } from '../../domain/format'
import type { Vehicle } from '../../domain/types'
import { Badge, Button, EmptyState, ListGroup, ListItem } from '../../ui'
import { Page } from '../common'
import { VehicleThumb } from '../vehicle/details/VehicleThumb'
import { vehicleSubtitle } from '../vehicle/details/vehicleText'
import styles from './Garage.module.css'

function VehicleRow({ vehicle, active, onOpen }: { vehicle: Vehicle; active: boolean; onOpen(): void }) {
  const odometer = useCurrentOdometer(vehicle.id)
  return (
    <ListItem
      leading={<VehicleThumb vehicle={vehicle} />}
      title={
        <span className={styles.title}>
          <span className={styles.name}>{vehicle.name}</span>
          {active && <Badge tone="accent">Активная</Badge>}
        </span>
      }
      subtitle={vehicleSubtitle(vehicle) || undefined}
      value={odometer != null ? formatKm(odometer) : undefined}
      chevron
      onClick={onOpen}
    />
  )
}

/** Гараж: машины в работе (активная помечена) и архив проданных. */
export default function GaragePage() {
  const navigate = useNavigate()
  const vehicles = useVehicles({ includeArchived: true })
  const { vehicle: active } = useActiveVehicle()
  if (!vehicles) return <Page title="Гараж" back="/more" />

  const current = vehicles.filter((v) => !v.archived)
  const archived = vehicles.filter((v) => v.archived)
  const row = (v: Vehicle) => (
    <VehicleRow
      key={v.id}
      vehicle={v}
      active={v.id === active?.id}
      onOpen={() => void navigate(`/vehicle/${v.id}`)}
    />
  )
  const add = (
    <Button variant="secondary" block icon={<IconPlus />} onClick={() => void navigate('/vehicle/new')}>
      Добавить машину
    </Button>
  )

  return (
    <Page title="Гараж" back="/more">
      {current.length > 0 ? (
        <>
          <ListGroup title="Мои машины">{current.map(row)}</ListGroup>
          {add}
        </>
      ) : (
        <EmptyState
          icon={<IconCar />}
          title="Нет машин в работе"
          text="Добавьте машину — записи, напоминания и статистика ведутся по ней."
          action={add}
        />
      )}
      {archived.length > 0 && (
        <ListGroup title="Архив" footer="Проданные машины: история и расходы сохраняются.">
          {archived.map(row)}
        </ListGroup>
      )}
    </Page>
  )
}
