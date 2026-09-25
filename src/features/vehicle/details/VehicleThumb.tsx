import { IconCar } from '@tabler/icons-react'
import type { Vehicle } from '../../../domain/types'
import { Icon } from '../../../ui'
import styles from './details.module.css'
import { useVehiclePhoto } from './useVehiclePhoto'

/** Значок машины в строке списка: фото 40×40 или машинка в кружке. */
export function VehicleThumb({ vehicle }: { vehicle: Vehicle }) {
  const url = useVehiclePhoto(vehicle)
  if (url) return <img className={styles.thumb} src={url} alt="" />
  return <Icon icon={IconCar} tone="accent" circle />
}
