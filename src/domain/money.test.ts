import { expect, test } from 'vitest'
import { parseMoneyExpression, toKopecks, toRubles } from './money'

test('рубли ↔ копейки', () => {
  expect(toKopecks(12450)).toBe(1245000)
  expect(toKopecks(0.1 + 0.2)).toBe(30)
  expect(toRubles(123456)).toBe(1234.56)
})

test.each([
  ['1200', 120000],
  ['1 200,50', 120050],
  ['1200.5', 120050],
  ['1200+650', 185000],
  ['500*2', 100000],
  ['1000-250', 75000],
  ['10/3', 333],
  ['(100+50)*2', 30000],
])('выражение %s = %i коп.', (input, expected) => {
  expect(parseMoneyExpression(input)).toBe(expected)
})

test.each(['', '   ', 'abc', '1200+', '100-200', '1/0', '2**3'])('некорректное «%s» → null', (input) => {
  expect(parseMoneyExpression(input)).toBeNull()
})

test('глубина скобок ограничена: слишком глубокое выражение → null, а не падение', () => {
  expect(parseMoneyExpression(`${'('.repeat(10)}100${')'.repeat(10)}`)).toBe(10000)
  expect(parseMoneyExpression(`${'('.repeat(51)}1${')'.repeat(51)}`)).toBeNull()
  expect(parseMoneyExpression(`${'('.repeat(100000)}1${')'.repeat(100000)}`)).toBeNull()
})
