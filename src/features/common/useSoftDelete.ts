import { useCallback } from 'react'
import { useToast } from '../../ui'
import { DELETE_FAILED, RESTORE_FAILED, userMessage } from './errors'

export interface SoftDeleteOptions {
  /** Мягкое удаление через репозиторий (`repos.records.remove(id)`). */
  remove(): Promise<void>
  /** Возврат той же строки (`repos.records.restore(id)`). */
  restore(): Promise<void>
  /** Текст уведомления: «Запись удалена», «Место удалено». */
  text: string
}

/**
 * Удаление с «Отменить»: удаляет и 5 секунд показывает уведомление с кнопкой возврата.
 * Ошибку удаления или возврата показывает уведомлением (текст `UserError` или общий) — экрану ловить нечего.
 */
export function useSoftDelete(): (opts: SoftDeleteOptions) => Promise<void> {
  const toast = useToast()
  return useCallback(
    async ({ remove, restore, text }: SoftDeleteOptions) => {
      try {
        await remove()
      } catch (e) {
        toast.show({ text: userMessage(e, DELETE_FAILED) })
        return
      }
      toast.show({
        text,
        action: {
          label: 'Отменить',
          onClick: () => {
            restore().catch((e: unknown) => toast.show({ text: userMessage(e, RESTORE_FAILED) }))
          },
        },
      })
    },
    [toast],
  )
}
