import { useCallback, useEffect, useMemo, useState } from 'react'
import { db } from '../../db/instance'
import { newId } from '../../domain/ids'
import type { ID, OwnerType } from '../../domain/types'
import { attachmentStore } from '../../sync/index'

export interface DraftAttachments {
  /** id будущей строки: вложения цепляются к нему ещё до сохранения. Сохраняйте строку ИМЕННО с этим id. */
  ownerId: ID
  /**
   * Убирает вложения черновика, если строка так и не сохранена (или сохранена и удалена).
   * Сохранённую строку не трогает. Вызывается и сама — при уходе с формы.
   */
  discard(): Promise<void>
}

const OWNER_TABLE = {
  record: 'records',
  vehicle: 'vehicles',
  document: 'documents',
  tireSet: 'tireSets',
} as const satisfies Record<OwnerType, string>

/**
 * Вложения для ещё не сохранённой строки (новая запись, машина, документ, комплект шин).
 * При размонтировании (сохранили и ушли, «Назад», жест «назад» Android, любой переход) черновик убирается сам:
 * есть живая строка с `ownerId` — вложения остаются при ней, нет — мягко удаляются.
 */
export function useDraftAttachments(ownerType: OwnerType): DraftAttachments {
  const [ownerId] = useState(newId)

  const discard = useCallback(async () => {
    const owner = await db.table<{ deleted?: boolean }, ID>(OWNER_TABLE[ownerType]).get(ownerId)
    if (owner && !owner.deleted) return
    const rows = await db.attachments.where('[ownerType+ownerId]').equals([ownerType, ownerId]).toArray()
    await Promise.all(rows.filter((a) => !a.deleted).map((a) => attachmentStore.remove(a)))
  }, [ownerType, ownerId])

  useEffect(
    () => () => {
      discard().catch((e: unknown) => console.warn('Вложения черновика не убраны', e))
    },
    [discard],
  )

  return useMemo(() => ({ ownerId, discard }), [ownerId, discard])
}
