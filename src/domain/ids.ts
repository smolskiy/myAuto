import type { ID } from './types'

export function newId(): ID {
  return crypto.randomUUID()
}
