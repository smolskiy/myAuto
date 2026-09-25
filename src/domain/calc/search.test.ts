import { expect, test } from 'vitest'
import { normalizeText, searchRecords } from './search'
import { note, service } from './fixtures'
import type { Master, Place } from '../types'

const place: Place = { id: 'pl', createdAt: 1, updatedAt: 1, kind: 'service', name: 'Автосервис «Ёлка»' }
const master: Master = { id: 'm', createdAt: 1, updatedAt: 1, name: 'Сергей Петрович' }
const recs = [
  service({
    id: 's1',
    date: '2026-01-01',
    title: 'ТО-15',
    placeId: 'pl',
    masterId: 'm',
    parts: [
      {
        id: 'p',
        name: 'Масляный фильтр',
        brand: 'Mann-Filter',
        partNumber: 'W 712/95',
        qty: 1,
        unit: 'pcs',
        ownPart: true,
      },
    ],
  }),
  note({ id: 'n1', date: '2026-02-01', title: 'Стук справа', note: 'после ямы' }),
]
const lookup = { places: new Map([['pl', place]]), masters: new Map([['m', master]]), catalog: new Map() }

test('нормализация', () => {
  expect(normalizeText('  ЁЛКА-Палка ')).toBe('елка-палка')
})

test.each([
  ['w 712', ['s1']],
  ['MANN', ['s1']],
  ['елка', ['s1']],
  ['петрович', ['s1']],
  ['ямы', ['n1']],
  ['то-15', ['s1']],
  ['нет такого', []],
])('поиск «%s»', (q, ids) => {
  expect(searchRecords(recs, q, lookup).map((r) => r.id)).toEqual(ids)
})
