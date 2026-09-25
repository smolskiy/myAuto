import { expect, test } from 'vitest'
import { formatMoneyInput, hasOperator, parseMoneyExpr } from './moneyExpr'

test.each([
  ['1200', 120000],
  ['1200+650', 185000],
  ['1 200 + 650', 185000],
  ['1\u00A0200,50', 120050],
  ['99.9', 9990],
  ['(100+50)*2', 30000],
  ['1000/3', 33333],
  ['2*3+4', 1000],
  ['2+3*4', 1400],
  ['10-2-3', 500],
  ['100/4/5', 500],
  ['0,1+0,2', 30],
  ['500−100', 40000],
  ['3×200', 60000],
])('%s → %i копеек', (input, kopecks) => {
  expect(parseMoneyExpr(input)).toBe(kopecks)
})

test.each([
  '',
  '   ',
  '12++',
  '12+',
  '(1+2',
  '1+2)',
  'abc',
  '1,2,3',
  '5/0',
  '100-200',
  '-5',
  '1e3',
  'alert(1)',
  '1..2',
  // Унарного минуса нет — как в domain/money.ts.
  '-50+100',
])('некорректное или отрицательное «%s» → null', (input) => {
  expect(parseMoneyExpr(input)).toBeNull()
})

test('оператор в выражении виден, знак числа — нет', () => {
  expect(hasOperator('1200+650')).toBe(true)
  expect(hasOperator('2*3')).toBe(true)
  expect(hasOperator('1 200,50')).toBe(false)
  expect(hasOperator('-5')).toBe(false)
})

test('сумма для поля — разряды неразрывным пробелом, копейки через запятую', () => {
  expect(formatMoneyInput(185000)).toBe('1\u00A0850')
  expect(formatMoneyInput(12345678)).toBe('123\u00A0456,78')
  expect(formatMoneyInput(5)).toBe('0,05')
  expect(formatMoneyInput(0)).toBe('0')
})

// Те же случаи, что в src/domain/money.test.ts: разборщики ведут себя одинаково.
test.each([
  ['1200', 120000],
  ['1 200,50', 120050],
  ['1200.5', 120050],
  ['1200+650', 185000],
  ['500*2', 100000],
  ['1000-250', 75000],
  ['10/3', 333],
  ['(100+50)*2', 30000],
])('как в domain: выражение %s = %i коп.', (input, expected) => {
  expect(parseMoneyExpr(input)).toBe(expected)
})

test.each(['', '   ', 'abc', '1200+', '100-200', '1/0', '2**3'])(
  'как в domain: некорректное «%s» → null',
  (input) => {
    expect(parseMoneyExpr(input)).toBeNull()
  },
)

test('глубина скобок ограничена 50: глубже — null, а не падение', () => {
  expect(parseMoneyExpr(`${'('.repeat(10)}100${')'.repeat(10)}`)).toBe(10000)
  expect(parseMoneyExpr(`${'('.repeat(50)}1${')'.repeat(50)}`)).toBe(100)
  expect(parseMoneyExpr(`${'('.repeat(51)}1${')'.repeat(51)}`)).toBeNull()
  expect(parseMoneyExpr(`${'('.repeat(100000)}1${')'.repeat(100000)}`)).toBeNull()
})

test('копейки в сумме — всегда два знака', () => {
  expect(formatMoneyInput(5490)).toBe('54,90')
  expect(formatMoneyInput(5409)).toBe('54,09')
})
