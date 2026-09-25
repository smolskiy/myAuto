import { expect, test } from 'vitest'
import { matches } from './pickerQuery'

test('поиск без учёта регистра и «ё»', () => {
  expect(matches('Щётки стеклоочистителя', 'щетки')).toBe(true)
  expect(matches('Моторное масло', '')).toBe(true)
})

test('несколько слов — каждое где угодно в названии, в любом порядке', () => {
  expect(matches('Рычаг передний нижний', 'рычаг перед')).toBe(true)
  expect(matches('Рычаг передний нижний', 'нижн рычаг')).toBe(true)
  expect(matches('Рычаг передний нижний', 'рычаг задн')).toBe(false)
})
