import { expect, test } from 'vitest'

test('indexedDB доступен в тестах', () => {
  expect(globalThis.indexedDB).toBeDefined()
})
