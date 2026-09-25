import { IconPlus, IconWheel } from '@tabler/icons-react'
import { useNavigate } from 'react-router'
import { useTireSetMileage, useTireSets } from '../../db/hooks'
import { formatKm } from '../../domain/format'
import type { TireSet, TireSetStatus, Vehicle } from '../../domain/types'
import { Button, EmptyState, Icon, ListGroup, ListItem } from '../../ui'
import { Page, TIRE_STATUS_LABELS, VehicleGate } from '../common'
import { tireSetSubtitle, tireSetTitle } from './tireText'

const STATUSES = Object.keys(TIRE_STATUS_LABELS) as TireSetStatus[]

function TireSetRow({ set, onOpen }: { set: TireSet; onOpen(): void }) {
  const mileage = useTireSetMileage(set.id)
  return (
    <ListItem
      leading={<Icon icon={IconWheel} tone={set.status === 'installed' ? 'accent' : 'neutral'} circle />}
      title={tireSetTitle(set)}
      subtitle={tireSetSubtitle(set)}
      value={mileage ? formatKm(mileage) : undefined}
      chevron
      onClick={onOpen}
    />
  )
}

function TireSetsList({ vehicle }: { vehicle: Vehicle }) {
  const navigate = useNavigate()
  const sets = useTireSets(vehicle.id)
  if (!sets) return null
  const add = (
    <Button variant="secondary" block icon={<IconPlus />} onClick={() => void navigate('/tires/new')}>
      Добавить комплект
    </Button>
  )
  if (sets.length === 0) {
    return (
      <EmptyState
        icon={<IconWheel />}
        title="Комплектов пока нет"
        text="Летние и зимние шины: где хранятся, сколько проехали, когда куплены."
        action={add}
      />
    )
  }
  return (
    <>
      {STATUSES.map((status) => {
        const rows = sets.filter((s) => s.status === status)
        if (rows.length === 0) return null
        return (
          <ListGroup key={status} title={TIRE_STATUS_LABELS[status]}>
            {rows.map((s) => (
              <TireSetRow key={s.id} set={s} onOpen={() => void navigate(`/tires/${s.id}`)} />
            ))}
          </ListGroup>
        )
      })}
      {add}
    </>
  )
}

/** Комплекты шин активной машины: установлены, на хранении, списаны — с пробегом комплекта. */
export default function TiresPage() {
  return (
    <Page title="Шины" back="/more">
      <VehicleGate>{(vehicle) => <TireSetsList vehicle={vehicle} />}</VehicleGate>
    </Page>
  )
}
