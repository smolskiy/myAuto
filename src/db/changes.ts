import type { TableName } from '../domain/snapshot'

const listeners = new Set<(table: TableName) => void>()

export function subscribeLocalChanges(cb: (table: TableName) => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function emitLocalChange(table: TableName): void {
  for (const cb of listeners) cb(table)
}
