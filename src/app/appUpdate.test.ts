import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createAppUpdate } from './appUpdate'

const registration = (over: Partial<ServiceWorkerRegistration> = {}) =>
  ({
    update: vi.fn(async () => {}),
    installing: null,
    waiting: null,
    ...over,
  }) as unknown as ServiceWorkerRegistration

const setVisibility = (state: DocumentVisibilityState) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  setVisibility('visible')
})

test('новая версия, скачанная до подписки, не теряется: подписчик узнаёт о ней сразу', () => {
  const u = createAppUpdate()
  const apply = vi.fn(async () => {})
  u.setReady(apply)
  expect(u.isReady()).toBe(true)
  const seen = vi.fn()
  u.subscribe(seen)
  expect(seen).not.toHaveBeenCalled() // подписка не зовёт сама: состояние читают через isReady
  void u.apply()
  expect(apply).toHaveBeenCalled()
})

test('возврат в приложение проверяет обновление, но не чаще раза в минуту; и раз в час сама', async () => {
  const u = createAppUpdate()
  const r = registration()
  const stop = u.watch(r)
  setVisibility('hidden')
  setVisibility('visible')
  expect(r.update).toHaveBeenCalledTimes(1)
  setVisibility('visible')
  expect(r.update).toHaveBeenCalledTimes(1)
  vi.advanceTimersByTime(61_000)
  setVisibility('visible')
  expect(r.update).toHaveBeenCalledTimes(2)
  vi.advanceTimersByTime(60 * 60_000)
  expect(r.update).toHaveBeenCalledTimes(3)
  stop()
})

test('возврат в приложение, когда новая версия уже ждёт, снова напоминает о ней', () => {
  const u = createAppUpdate()
  u.watch(registration())
  u.setReady(async () => {})
  const seen = vi.fn()
  u.subscribe(seen)
  setVisibility('visible')
  expect(seen).toHaveBeenCalled()
})

test('проверка по кнопке: скачивается / последняя / нет сети', async () => {
  const u = createAppUpdate()
  expect(await u.check()).toBe('latest') // без service worker (разработка) — нечего обновлять
  u.watch(registration({ installing: {} as ServiceWorker }))
  expect(await u.check()).toBe('downloading')

  const v = createAppUpdate()
  v.watch(registration())
  expect(await v.check()).toBe('latest')
  v.setReady(async () => {})
  expect(await v.check()).toBe('ready')

  const w = createAppUpdate()
  w.watch(registration({ update: vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))) }))
  expect(await w.check()).toBe('offline')
})
