import { expect, test } from 'vitest'
import { PART_BRANDS, suggestBrands } from './brands'

test('справочник брендов', () => {
  const names = PART_BRANDS.map((b) => b.name)
  expect(new Set(names).size).toBe(names.length)
  expect(names.length).toBeGreaterThanOrEqual(100)
  for (const n of ['Mann-Filter', 'Mahle', 'Bosch', 'NGK', 'Motul', 'Лукойл', 'TRW', 'Gates', 'SKF']) {
    expect(names).toContain(n)
  }
})

test('сначала своя история по частоте, потом справочник по алфавиту; регистр не важен', () => {
  const history = ['Mahle', 'Mann-Filter', 'Mann-Filter', 'Febi']
  const r = suggestBrands('MA', history, 4)
  expect(r.slice(0, 2)).toEqual(['Mann-Filter', 'Mahle'])
  expect(r).toHaveLength(4)
  const rest = r.slice(2)
  expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b)))
  for (const b of rest) expect(b.toLowerCase().startsWith('ma')).toBe(true)
})

test('поиск по синониму', () => {
  expect(suggestBrands('манн', [], 3)).toContain('Mann-Filter')
  expect(suggestBrands('лукойл', [], 3)[0]).toBe('Лукойл')
  expect(suggestBrands('lukoil', [], 3)[0]).toBe('Лукойл')
})

test('пустой запрос — топ истории', () => {
  expect(suggestBrands('', ['Bosch', 'NGK', 'NGK'], 2)).toEqual(['NGK', 'Bosch'])
})
