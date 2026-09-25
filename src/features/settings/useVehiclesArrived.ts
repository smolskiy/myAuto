import { useState } from 'react'
import { useVehicles } from '../../db/hooks'

/**
 * Машины в базе и появились ли они при открытом экране: экран открыли без машин (новое устройство, пришли
 * с онбординга или вернулись со входа в Яндекс), а теперь они есть — после синхронизации или загрузки копии.
 * Архивные считаются: онбординг их тоже считает.
 */
export function useVehiclesArrived(): { hasVehicles: boolean; arrived: boolean } {
  const vehicles = useVehicles({ includeArchived: true })
  // Первый ответ живого запроса: пусто ли было при открытии экрана.
  const [startedEmpty, setStartedEmpty] = useState<boolean | undefined>(undefined)
  if (startedEmpty === undefined && vehicles !== undefined) setStartedEmpty(vehicles.length === 0)
  const hasVehicles = (vehicles?.length ?? 0) > 0
  return { hasVehicles, arrived: startedEmpty === true && hasVehicles }
}
