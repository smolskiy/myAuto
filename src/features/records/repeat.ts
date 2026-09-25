import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { repos } from '../../db/repos'
import type { ID } from '../../domain/types'
import { useToast } from '../../ui'
import { useToday, UserError } from '../common'

/** Состояние перехода на правку копии: форма зовётся «Копия записи», «Назад» копию убирает. */
export interface CopyState {
  copy: true
}

export function isCopyState(state: unknown): state is CopyState {
  return (state as Partial<CopyState> | null)?.copy === true
}

const REPEAT_FAILED = 'Не получилось повторить — попробуйте ещё раз'

/**
 * «Повторить» (карточка записи, свайп в журнале): копия на сегодня и её правка поверх текущего экрана.
 * «Сохранить» заменит правку карточкой копии, «Назад» уберёт копию.
 */
export function useRepeatRecord(): (id: ID) => Promise<void> {
  const navigate = useNavigate()
  const toast = useToast()
  const today = useToday()
  return useCallback(
    async (id: ID) => {
      try {
        const copy = await repos.records.duplicate(id, today)
        const state: CopyState = { copy: true }
        void navigate(`/record/${copy.id}/edit`, { state })
      } catch (e) {
        if (!(e instanceof UserError)) console.error(e)
        toast.show({ text: e instanceof UserError ? e.message : REPEAT_FAILED })
      }
    },
    [navigate, toast, today],
  )
}
