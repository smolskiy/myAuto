import { describe, expect, test } from 'vitest'
import { SCHEMA_VERSION, SnapshotError, TABLE_NAMES, emptySnapshot, parseSnapshot } from './snapshot'

const row = (id: string) => ({ id, createdAt: 1, updatedAt: 2 })

describe('snapshot', () => {
  test('пустой снимок содержит все таблицы', () => {
    const s = emptySnapshot(123)
    expect(s.format).toBe('myauto-garage')
    expect(s.schemaVersion).toBe(SCHEMA_VERSION)
    expect(s.exportedAt).toBe(123)
    expect(Object.keys(s.tables).sort()).toEqual([...TABLE_NAMES].sort())
    for (const t of TABLE_NAMES) expect(s.tables[t]).toEqual([])
  })

  test('разбирает корректный снимок и сохраняет неизвестные поля строк', () => {
    const input = {
      ...emptySnapshot(5),
      tables: { ...emptySnapshot().tables, places: [{ ...row('p1'), future: 'x' }] },
    }
    const parsed = parseSnapshot(JSON.parse(JSON.stringify(input)))
    expect(parsed.tables.places).toEqual([{ ...row('p1'), future: 'x' }])
  })

  test('недостающие таблицы становятся пустыми (старый бэкап)', () => {
    const parsed = parseSnapshot({
      format: 'myauto-garage',
      schemaVersion: 1,
      exportedAt: 1,
      tables: { vehicles: [] },
    })
    expect(parsed.tables.records).toEqual([])
    expect(parsed.tables.tireSets).toEqual([])
  })

  test('чужой файл — понятная ошибка', () => {
    expect(() => parseSnapshot({ hello: 1 })).toThrow(SnapshotError)
    expect(() => parseSnapshot({ hello: 1 })).toThrow('Это не файл «Мой авто»')
    expect(() => parseSnapshot('text')).toThrow('Это не файл «Мой авто»')
  })

  test('снимок из будущей версии — отказ', () => {
    const future = { ...emptySnapshot(), schemaVersion: SCHEMA_VERSION + 1 }
    expect(() => parseSnapshot(future)).toThrow(
      'Файл создан более новой версией приложения — обновите приложение',
    )
  })

  test('строка без id или updatedAt — отказ с названием таблицы', () => {
    const bad = {
      ...emptySnapshot(),
      tables: { ...emptySnapshot().tables, records: [{ createdAt: 1, updatedAt: 1 }] },
    }
    expect(() => parseSnapshot(bad)).toThrow('Повреждённая строка в таблице records')
    const bad2 = {
      ...emptySnapshot(),
      tables: { ...emptySnapshot().tables, masters: [{ id: 'm', createdAt: 1 }] },
    }
    expect(() => parseSnapshot(bad2)).toThrow('Повреждённая строка в таблице masters')
  })
})
