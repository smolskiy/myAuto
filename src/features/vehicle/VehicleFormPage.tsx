import { IconCarOff } from '@tabler/icons-react'
import { useParams } from 'react-router'
import { useVehicle } from '../../db/hooks'
import type { ID } from '../../domain/types'
import { EmptyState } from '../../ui'
import { Page } from '../common'
import { VehicleForm } from './form/VehicleForm'

function EditVehicle({ id }: { id: ID }) {
  const vehicle = useVehicle(id)
  if (vehicle === undefined) return null
  if (vehicle === null) {
    return (
      <Page title="Правка машины" back="/garage">
        <EmptyState
          icon={<IconCarOff />}
          title="Машина не найдена"
          text="Её удалили или она ещё не пришла с Диска."
        />
      </Page>
    )
  }
  // Ключ — id: живой запрос отдаёт новые копии той же машины, форму они не пересоздают.
  return <VehicleForm key={vehicle.id} initial={vehicle} onSaved={() => undefined} />
}

/** `/vehicle/new` — новая машина (после сохранения — её карточка), `/vehicle/:id/edit` — правка. */
export default function VehicleFormPage() {
  const { id } = useParams()
  if (id) return <EditVehicle key={id} id={id} />
  return <VehicleForm onSaved={(v) => `/vehicle/${v.id}`} />
}
