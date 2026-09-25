import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'

/**
 * «Назад»: на шаг по истории; экран открыт по ссылке (истории внутри приложения нет) — на `fallback`,
 * заменой, чтобы «назад» не выводил из приложения.
 */
export function useGoBack(): (fallback?: string) => void {
  const navigate = useNavigate()
  const { key } = useLocation()
  return useCallback(
    (fallback = '/') => {
      // Первая запись истории роутера всегда с ключом 'default'.
      if (key === 'default') void navigate(fallback, { replace: true })
      else void navigate(-1)
    },
    [key, navigate],
  )
}
