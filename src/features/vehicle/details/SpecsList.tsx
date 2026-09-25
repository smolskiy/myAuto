import { formatLiters } from '../../../domain/format'
import type { Vehicle } from '../../../domain/types'
import { ListGroup, ListItem } from '../../../ui'
import { DRIVE_LABELS, FLUID_KIND_LABELS, FUEL_TYPE_LABELS, TRANSMISSION_LABELS } from '../../common'
import { SpecRow } from './SpecRow'
import { formatEngine } from './vehicleText'

interface Spec {
  label: string
  value?: string
  mono?: boolean
}

function specs(v: Vehicle): Spec[] {
  const fuel = v.engine?.fuel ? FUEL_TYPE_LABELS[v.engine.fuel] : undefined
  const front = v.tireSizeFront?.trim()
  const rear = v.tireSizeRear?.trim()
  const tires: Spec[] =
    front && rear && front !== rear
      ? [
          { label: 'Шины спереди', value: front },
          { label: 'Шины сзади', value: rear },
        ]
      : [{ label: 'Шины', value: front || rear }]
  return [
    { label: 'Марка', value: v.make },
    { label: 'Модель', value: v.model },
    { label: 'Поколение', value: v.generation },
    { label: 'Год', value: v.year !== undefined ? String(v.year) : undefined },
    { label: 'VIN', value: v.vin, mono: true },
    { label: 'Госномер', value: v.plate },
    { label: 'Цвет', value: v.color },
    { label: 'Кузов', value: v.bodyType },
    { label: 'Двигатель', value: formatEngine(v.engine) },
    { label: 'Топливо', value: [fuel, v.defaultFuelGrade?.trim()].filter(Boolean).join(' · ') },
    { label: 'КПП', value: v.transmission ? TRANSMISSION_LABELS[v.transmission] : undefined },
    { label: 'Привод', value: v.drive ? DRIVE_LABELS[v.drive] : undefined },
    { label: 'Бак', value: v.tankLiters ? formatLiters(v.tankLiters) : undefined },
    ...tires,
  ]
}

/** «Характеристики» машины: только заполненные поля. */
export function SpecsList({ vehicle }: { vehicle: Vehicle }) {
  const rows = specs(vehicle).filter((s) => s.value?.trim())
  if (rows.length === 0) return null
  return (
    <ListGroup title="Характеристики">
      {rows.map((s) => (
        <SpecRow key={s.label} label={s.label} mono={s.mono}>
          {s.value}
        </SpecRow>
      ))}
    </ListGroup>
  )
}

/** «Жидкости» — паспорт жидкостей: вид, спецификация, объём. */
export function FluidsList({ vehicle }: { vehicle: Vehicle }) {
  if (vehicle.fluids.length === 0) return null
  return (
    <ListGroup title="Жидкости">
      {vehicle.fluids.map((f, i) => (
        <ListItem
          key={`${f.kind}-${i}`}
          title={FLUID_KIND_LABELS[f.kind]}
          subtitle={[f.spec?.trim(), f.note?.trim()].filter(Boolean).join(' · ') || undefined}
          value={f.volumeL ? formatLiters(f.volumeL) : undefined}
        />
      ))}
    </ListGroup>
  )
}
