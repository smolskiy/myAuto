import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

/** Есть ли куда шагнуть назад внутри приложения. */
function hasInAppHistory(locationKey: string): boolean {
  // Hash-роутер приложения хранит номер записи истории в history.state.idx: 0 — первая запись приложения,
  // даже если её заменили (редирект на онбординг), и тогда «назад» увёл бы из приложения.
  const idx: unknown = (window.history.state as { idx?: unknown } | null)?.idx
  if (typeof idx === 'number') return idx > 0
  // Memory-роутер (тесты) history.state не трогает: первая запись у него с ключом 'default'.
  return locationKey !== 'default'
}

/**
 * «Назад»: на шаг по истории; истории внутри приложения нет (открыли по ссылке, первая запись) — на `fallback`
 * заменой, чтобы «назад» не выводил из приложения.
 */
export function useGoBack(): (fallback?: string) => void {
  const navigate = useNavigate()
  const { key } = useLocation()
  return useCallback(
    (fallback = '/') => {
      if (hasInAppHistory(key)) void navigate(-1)
      else void navigate(fallback, { replace: true })
    },
    [key, navigate],
  )
}
