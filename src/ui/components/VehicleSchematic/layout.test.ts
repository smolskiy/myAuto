import { expect, test } from 'vitest'
import { placeCallouts } from './layout'

test('подпись над точкой на капоте и под точкой у колеса', () => {
  expect(placeCallouts([[26, 38]])[0]?.side).toBe('above')
  expect(placeCallouts([[49.5, 78.5]])[0]?.side).toBe('below')
})

test('у краёв подпись тянется внутрь картинки', () => {
  expect(placeCallouts([[11, 43]])[0]?.align).toBe('start')
  expect(placeCallouts([[50, 43]])[0]?.align).toBe('center')
  expect(placeCallouts([[91, 63]])[0]?.align).toBe('end')
})

test('две близкие подписи с одной стороны — вторая уходит на другую сторону', () => {
  const [a, b] = placeCallouts([
    [26, 38],
    [36, 42],
  ])
  expect(a?.side).toBe('above')
  expect(b?.side).toBe('below')
})

test('далёкие подписи остаются на своих сторонах', () => {
  const [a, b] = placeCallouts([
    [11, 43],
    [91, 30],
  ])
  expect(a?.side).toBe('above')
  expect(b?.side).toBe('above')
})
