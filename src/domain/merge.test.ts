import { describe, expect, test } from 'vitest'
import { emptySnapshot, type Snapshot } from './snapshot'
import { changedRows, diffTables, mergeRows, mergeSnapshots, sameSnapshot } from './merge'
import type { Place } from './types'

const p = (id: string, updatedAt: number, extra: Partial<Place> = {}): Place =>
  ({ id, createdAt: 1, updatedAt, kind: 'service', name: id, ...extra })
const snap = (places: Place[], exportedAt = 1): Snapshot => ({ ...emptySnapshot(exportedAt), tables: { ...emptySnapshot().tables, places } })

describe('слияние', () => {
  test('побеждает поздняя правка', () => {
    expect(mergeRows([p('a', 1, { name: 'старое' })], [p('a', 2, { name: 'новое' })])[0]!.name).toBe('новое')
  })

  test('при равном времени побеждает удаление', () => {
    expect(mergeRows([p('a', 5)], [p('a', 5, { deleted: true })])[0]!.deleted).toBe(true)
    expect(mergeRows([p('a', 5, { deleted: true })], [p('a', 5)])[0]!.deleted).toBe(true)
  })

  test('коммутативно и идемпотентно', () => {
    const a = snap([p('a', 3), p('b', 1, { name: 'x' })], 10)
    const b = snap([p('b', 1, { name: 'y' }), p('c', 2)], 20)
    const ab = mergeSnapshots(a, b)
    expect(ab).toEqual(mergeSnapshots(b, a))
    expect(mergeSnapshots(ab, ab)).toEqual(ab)
    expect(mergeSnapshots(ab, a)).toEqual(ab)
    expect(ab.exportedAt).toBe(20)
    expect(ab.tables.places.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  test('неизвестные поля сохраняются', () => {
    const future = { ...p('a', 9), futureField: 42 } as Place
    expect(mergeRows([p('a', 1)], [future])[0]).toHaveProperty('futureField', 42)
  })

  test('сравнение и изменённые строки', () => {
    const local = snap([p('a', 1), p('b', 1)])
    const merged = mergeSnapshots(local, snap([p('b', 2), p('c', 1)]))
    expect(sameSnapshot(local, merged)).toBe(false)
    expect(sameSnapshot(merged, mergeSnapshots(merged, local))).toBe(true)
    expect(changedRows(local.tables.places, merged.tables.places).map((r) => r.id)).toEqual(['b', 'c'])
    expect(diffTables(local.tables, merged.tables)).toEqual({ places: [p('b', 2), p('c', 1)] })
  })
})
