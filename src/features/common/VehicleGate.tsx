import { IconCar, IconPlus } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useActiveVehicle } from '../../db/hooks'
import type { Vehicle } from '../../domain/types'
import { Button, EmptyState } from '../../ui'

export interface VehicleGateProps {
  /** Экран активной машины. */
  children(vehicle: Vehicle): ReactNode
}

/** Экран про активную машину: пока грузится — пусто, машины нет — приглашение добавить. */
export function VehicleGate({ children }: VehicleGateProps) {
  const { vehicle } = useActiveVehicle()
  const navigate = useNavigate()
  if (vehicle === undefined) return null
  if (vehicle === null) {
    return (
      <EmptyState
        icon={<IconCar />}
        title="Добавьте машину"
        text="Записи, напоминания и статистика ведутся по машине."
        action={
          <Button icon={<IconPlus />} onClick={() => void navigate('/vehicle/new')}>
            Добавить машину
          </Button>
        }
      />
    )
  }
  return <>{children(vehicle)}</>
}
