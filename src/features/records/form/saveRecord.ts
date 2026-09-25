import type { Draft } from '../../../db/repo'
import { db } from '../../../db/instance'
import { repos } from '../../../db/repos'
import type { CarRecord, ID, ServiceRecord, TireSetStatus } from '../../../domain/types'

type TireSwap = NonNullable<ServiceRecord['tireSwap']>

const hasSet = (swap?: TireSwap): swap is TireSwap => !!swap && !!(swap.mountedSetId || swap.removedSetId)

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

/** Последняя живая смена шин машины (дата ↓, время ввода ↓) — только она говорит, что стоит на машине сейчас. */
async function isLatestSwap(vehicleId: ID, id: ID): Promise<boolean> {
  const swaps = (await db.records.where('vehicleId').equals(vehicleId).toArray()).filter(
    (r): r is ServiceRecord => r.kind === 'service' && !r.deleted && hasSet(r.tireSwap),
  )
  swaps.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  return swaps[0]?.id === id
}

const sameSwap = (before: CarRecord | undefined, swap: TireSwap) =>
  before?.kind === 'service' &&
  before.tireSwap?.mountedSetId === swap.mountedSetId &&
  before.tireSwap?.removedSetId === swap.removedSetId

/**
 * Запись в базу: новая — с id черновика (к нему уже привязаны фото), правка — в ту же строку.
 * Смена шин с выбранным комплектом пишется одной транзакцией с состояниями комплектов; состояния меняются, только
 * если это последняя смена шин машины и она новая или у неё изменились дата или комплекты (ввод старой истории
 * и правка заметки состояний не трогают).
 */
export async function saveRecord(draft: Draft<CarRecord>, id: ID, mode: 'create' | 'update'): Promise<void> {
  const swap = draft.kind === 'service' ? draft.tireSwap : undefined
  const write = () =>
    mode === 'create' ? repos.records.create({ ...draft, id }) : repos.records.update(id, draft)
  if (!hasSet(swap)) {
    await write()
    return
  }
  await db.transaction('rw', db.records, db.tireSets, async () => {
    const before = mode === 'update' ? await db.records.get(id) : undefined
    await write()
    const changed = mode === 'create' || before?.date !== draft.date || !sameSwap(before, swap)
    if (changed && (await isLatestSwap(draft.vehicleId, id))) await applyTireSwap(draft.vehicleId, swap)
  })
}
