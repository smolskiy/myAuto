import { useCallback } from 'react'
import { useToast } from '../../ui'

export interface SoftDeleteOptions {
  /** Мягкое удаление через репозиторий (`repos.records.remove(id)`). */
  remove(): Promise<void>
  /** Возврат той же строки (`repos.records.restore(id)`). */
  restore(): Promise<void>
  /** Текст уведомления: «Запись удалена», «Место удалено». */
  text: string
}

const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message) || fallback

/**
 * Удаление с «Отменить»: удаляет и 5 секунд показывает уведомление с кнопкой возврата.
 * Ошибку удаления или возврата показывает уведомлением — экрану ловить нечего.
 */
export function useSoftDelete(): (opts: SoftDeleteOptions) => Promise<void> {
  const toast = useToast()
  return useCallback(
    async ({ remove, restore, text }: SoftDeleteOptions) => {
      try {
        await remove()
      } catch (e) {
        toast.show({ text: errorText(e, 'Не удалось удалить') })
        return
      }
      toast.show({
        text,
        action: {
          label: 'Отменить',
          onClick: () => {
            restore().catch((e: unknown) => toast.show({ text: errorText(e, 'Не удалось вернуть') }))
          },
        },
      })
    },
    [toast],
  )
}
