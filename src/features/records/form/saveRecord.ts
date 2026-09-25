import type { Draft } from '../../../db/repo'
import { db } from '../../../db/instance'
import { repos } from '../../../db/repos'
import type { CarRecord, ID, ServiceRecord, TireSetStatus } from '../../../domain/types'

type TireSwap = NonNullable<ServiceRecord['tireSwap']>

/**
 * Состояния комплектов после смены шин: установленный — «Установлены», прежние установленные этой машины
 * и снятый — «На хранении». Списанные и чужие комплекты не трогаются.
 */
async function applyTireSwap(vehicleId: ID, swap: TireSwap): Promise<void> {
  const sets = (await db.tireSets.where('vehicleId').equals(vehicleId).toArray()).filter((s) => !s.deleted)
  for (const s of sets) {
    let status: TireSetStatus = s.status
    if (s.id === swap.mountedSetId) status = 'installed'
    else if (s.id === swap.removedSetId) status = 'stored'
    else if (swap.mountedSetId && s.status === 'installed') status = 'stored'
    if (status !== s.status) await repos.tireSets.update(s.id, { status })
  }
}

/**
 * Запись в базу: новая — с id черновика (к нему уже привязаны фото), правка — в ту же строку.
 * Смена шин с выбранным комплектом пишет запись и состояния комплектов одной транзакцией.
 */
export async function saveRecord(draft: Draft<CarRecord>, id: ID, mode: 'create' | 'update'): Promise<void> {
  const swap = draft.kind === 'service' ? draft.tireSwap : undefined
  const write = async () => {
    if (mode === 'create') await repos.records.create({ ...draft, id })
    else await repos.records.update(id, draft)
    if (swap && (swap.mountedSetId || swap.removedSetId)) await applyTireSwap(draft.vehicleId, swap)
  }
  if (swap) await db.transaction('rw', db.records, db.tireSets, write)
  else await write()
}
