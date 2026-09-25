import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import type { CarRecord } from '../../domain/types'

/**
 * «Повторить» (карточка записи, свайп в журнале): форма новой записи, предзаполненная из этой
 * (`/record/new/<вид>?from=<id>`). В базу ничего не пишется до «Сохранить».
 */
export function useRepeatRecord(): (r: Pick<CarRecord, 'id' | 'kind'>) => void {
  const navigate = useNavigate()
  return useCallback(
    (r: Pick<CarRecord, 'id' | 'kind'>) =>
      void navigate(`/record/new/${r.kind}?from=${encodeURIComponent(r.id)}`),
    [navigate],
  )
}
