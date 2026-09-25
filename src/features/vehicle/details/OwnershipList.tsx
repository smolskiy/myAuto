import { formatKm, formatMoney } from '../../../domain/format'
import type { CarRecord, Kopecks, Vehicle } from '../../../domain/types'
import { ListGroup } from '../../../ui'
import { SpecRow } from './SpecRow'
import { formatDeal, ownershipKm, ownershipTotal, ownershipTotalLabel } from './vehicleText'

export interface OwnershipListProps {
  vehicle: Vehicle
  /** Все живые записи машины (для «Проехал»). */
  records: CarRecord[]
  /** Расходы за всё время (`useCostBreakdown(id).total`). */
  expenses: Kopecks
}

/** «Владение»: покупка, продажа, расходы и итог с покупкой и продажей, километры за время владения. */
export function OwnershipList({ vehicle, records, expenses }: OwnershipListProps) {
  const bought = formatDeal(vehicle.purchase)
  const sold = formatDeal(vehicle.sale)
  const total = ownershipTotal(vehicle, expenses)
  const km = ownershipKm(vehicle, records)
  return (
    <ListGroup
      title="Владение"
      footer={total !== undefined ? 'Расходы за всё время плюс цена покупки минус цена продажи.' : undefined}
    >
      {bought && <SpecRow label="Куплена">{bought}</SpecRow>}
      {sold && <SpecRow label="Продана">{sold}</SpecRow>}
      <SpecRow label="Расходы за всё время">{formatMoney(expenses)}</SpecRow>
      {total !== undefined && <SpecRow label={ownershipTotalLabel(vehicle)}>{formatMoney(total)}</SpecRow>}
      {km !== null && <SpecRow label="Проехал">{formatKm(km)}</SpecRow>}
    </ListGroup>
  )
}
