import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useVehicles } from '../db/hooks'

/** Страницы, открытые и без машин: онбординг, витрина и настройки (подключить Диск, загрузить копию). */
const OPEN_WITHOUT_VEHICLE = /^\/(onboarding|showcase|settings)(\/|$)/

/**
 * Первый запуск: машин нет — ведём на онбординг. Архивные машины считаются — у владельца,
 * продавшего все машины, остаётся история, и онбординг ему не нужен.
 *
 * Возвращает `true`, пока экран показывать нельзя: машины ещё грузятся или сейчас будет переход
 * на онбординг (иначе мелькнули бы экран и нижняя панель).
 */
export function useFirstRunRedirect(): boolean {
  const vehicles = useVehicles({ includeArchived: true })
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const open = OPEN_WITHOUT_VEHICLE.test(pathname)
  const noVehicles = vehicles?.length === 0

  useEffect(() => {
    if (noVehicles && !open) navigate('/onboarding', { replace: true })
  }, [noVehicles, open, navigate])

  return !open && (vehicles === undefined || noVehicles)
}
