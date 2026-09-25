import { useEffect, useState } from 'react'
import type { CarMake } from '../../../domain/carCatalog'

let cache: CarMake[] | undefined

/**
 * Справочник машин для подсказок формы. Большой — грузится отдельным куском при первом открытии формы машины
 * (в офлайн-кеше, как всё приложение); пока грузится — подсказок нет, поля работают как обычные.
 */
export function useCarCatalog(): CarMake[] | undefined {
  const [makes, setMakes] = useState(cache)
  useEffect(() => {
    if (cache) return
    let alive = true
    void import('../../../domain/carCatalog.json').then((m) => {
      cache = (m.default as { makes: CarMake[] }).makes
      if (alive) setMakes(cache)
    })
    return () => {
      alive = false
    }
  }, [])
  return makes
}
