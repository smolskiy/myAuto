import { useCallback, useMemo, useState } from 'react'
import { db } from '../../db/instance'
import { newId } from '../../domain/ids'
import type { ID, OwnerType } from '../../domain/types'
import { attachmentStore } from '../../sync/index'

export interface DraftAttachments {
  /** id будущей строки: вложения цепляются к нему ещё до сохранения; сохраняйте строку с этим id. */
  ownerId: ID
  /** Отмена формы: мягко удаляет вложения, добавленные к черновику. */
  discard(): Promise<void>
}

/** Вложения для ещё не сохранённой строки (новая запись, документ, комплект шин). */
export function useDraftAttachments(ownerType: OwnerType): DraftAttachments {
  const [ownerId] = useState(newId)
  const discard = useCallback(async () => {
    const rows = await db.attachments.where('[ownerType+ownerId]').equals([ownerType, ownerId]).toArray()
    await Promise.all(rows.filter((a) => !a.deleted).map((a) => attachmentStore.remove(a)))
  }, [ownerType, ownerId])
  return useMemo(() => ({ ownerId, discard }), [ownerId, discard])
}
