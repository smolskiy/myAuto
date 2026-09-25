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

test('две подписи с одной стороны — вторая уходит на другую сторону', () => {
  const [a, b] = placeCallouts([
    [26, 38],
    [36, 42],
  ])
  expect(a?.side).toBe('above')
  expect(b?.side).toBe('below')
})

test('даже далёкие: плашки шире, чем кажется по точкам (оба колеса)', () => {
  const [a, b] = placeCallouts([
    [49.5, 78.5],
    [91.2, 63.5],
  ])
  expect(a?.side).toBe('below')
  expect(b?.side).toBe('above')
})

test('подписи на разных сторонах не двигаются', () => {
  const [a, b] = placeCallouts([
    [26, 38],
    [49.5, 78.5],
  ])
  expect(a?.side).toBe('above')
  expect(b?.side).toBe('below')
})
