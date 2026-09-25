import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useVehicles } from '../db/hooks'

/** Страницы, открытые и без машин: онбординг, витрина и настройки (подключить Диск, загрузить копию). */
const OPEN_WITHOUT_VEHICLE = /^\/(onboarding|showcase|settings)(\/|$)/

/**
 * Первый запуск: машин нет — ведём на онбординг. Архивные машины считаются — у владельца,
 * продавшего все машины, остаётся история, и онбординг ему не нужен.
 */
export function useFirstRunRedirect(): void {
  const vehicles = useVehicles({ includeArchived: true })
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const noVehicles = vehicles?.length === 0

  useEffect(() => {
    if (noVehicles && !OPEN_WITHOUT_VEHICLE.test(pathname)) navigate('/onboarding', { replace: true })
  }, [noVehicles, pathname, navigate])
}
