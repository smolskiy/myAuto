import type { MyAutoDB } from './schema'
import type { TableName } from '../domain/snapshot'
import type { ID, Row } from '../domain/types'
import { newId } from '../domain/ids'
import { tick } from './clock'
import { emitLocalChange } from './changes'

/** Черновик для создания строки: без служебных полей, id — опционален (иначе генерируется). */
export type Draft<T extends Row> = T extends Row
  ? Omit<T, 'id' | 'createdAt' | 'updatedAt' | 'deleted'> & { id?: ID }
  : never

/** Патч для правки строки: без служебных полей, кроме deleted (мягкое удаление — через remove/restore). */
export type Patch<T extends Row> = T extends Row ? Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>> : never

export interface Repo<T extends Row> {
  get(id: ID): Promise<T | undefined>
  list(): Promise<T[]>
  create(draft: Draft<T>): Promise<T>
  update(id: ID, patch: Patch<T>): Promise<T>
  remove(id: ID): Promise<void>
  restore(id: ID): Promise<void>
}

export function createRepo<T extends Row>(db: MyAutoDB, table: TableName): Repo<T> {
  const t = db.table<T, ID>(table)

  return {
    async get(id) {
      const row = await t.get(id)
      return row && !row.deleted ? row : undefined
    },

    async list() {
      const rows = await t.toArray()
      return rows.filter((r) => !r.deleted)
    },

    async create(draft) {
      const now = tick()
      const id = (draft as Draft<Row>).id ?? newId()
      const row = { ...draft, id, createdAt: now, updatedAt: now } as unknown as T
      await t.put(row)
      emitLocalChange(table)
      return row
    },

    async update(id, patch) {
      const existing = await t.get(id)
      if (!existing || existing.deleted) throw new Error('Запись не найдена')
      const updated = { ...existing, ...patch, updatedAt: tick(existing.updatedAt) } as T
      await t.put(updated)
      emitLocalChange(table)
      return updated
    },

    async remove(id) {
      const existing = await t.get(id)
      if (!existing) return
      await t.put({ ...existing, deleted: true, updatedAt: tick(existing.updatedAt) })
      emitLocalChange(table)
    },

    async restore(id) {
      const existing = await t.get(id)
      if (!existing) return
      await t.put({ ...existing, deleted: false, updatedAt: tick(existing.updatedAt) })
      emitLocalChange(table)
    },
  }
}
