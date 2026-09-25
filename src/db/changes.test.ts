import { afterEach, expect, test, vi } from 'vitest'
import { emitLocalChange, subscribeLocalChanges } from './changes'

afterEach(() => {
  vi.restoreAllMocks()
})

test('ошибка в одном подписчике не мешает другим и не прерывает emitLocalChange', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const seen: string[] = []
  const offBad = subscribeLocalChanges(() => {
    throw new Error('boom')
  })
  const offGood = subscribeLocalChanges((t) => seen.push(t))

  expect(() => emitLocalChange('places')).not.toThrow()

  expect(seen).toEqual(['places'])
  expect(warn).toHaveBeenCalledTimes(1)

  offBad()
  offGood()
})
