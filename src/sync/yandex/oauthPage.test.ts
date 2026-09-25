import { beforeEach, expect, test, vi } from 'vitest'
import html from '../../../public/oauth.html?raw'
import { OAUTH_TOKEN_KEY } from './oauth'

/** Выполняет inline-скрипт public/oauth.html с подставными location/history/localStorage. */
function runOauthPage(hash: string) {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)![1]!
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1]!
  document.body.innerHTML = body.replace(/<script>[\s\S]*?<\/script>/, '')
  const stored = new Map<string, string>()
  const fakeLocation = { hash, pathname: '/myAuto/oauth.html', search: '', replace: vi.fn() }
  const fakeHistory = { replaceState: vi.fn() }
  const fakeStorage = { setItem: (k: string, v: string) => void stored.set(k, v) }
  new Function('location', 'history', 'localStorage', 'document', script)(fakeLocation, fakeHistory, fakeStorage, document)
  return { stored, location: fakeLocation, history: fakeHistory }
}

beforeEach(() => { document.body.innerHTML = '' })

test('oauth.html сохраняет токен со state, стирает фрагмент и уходит в приложение', () => {
  const { stored, location, history } = runOauthPage('#access_token=y0_T&token_type=bearer&expires_in=31536000&state=s1')
  expect(JSON.parse(stored.get(OAUTH_TOKEN_KEY)!)).toEqual({ token: 'y0_T', state: 's1' })
  expect(history.replaceState).toHaveBeenCalledWith(null, '', '/myAuto/oauth.html')
  expect(location.replace).toHaveBeenCalledWith('./#/settings/sync')
})

test('oauth.html при отказе передаёт ошибку Яндекса приложению, токен не пишет', () => {
  const { stored, location } = runOauthPage('#error=access_denied&error_description=%D0%9E%D1%82%D0%BA%D0%B0%D0%B7&state=s1')
  expect(JSON.parse(stored.get(OAUTH_TOKEN_KEY)!)).toEqual({ error: 'access_denied', errorDescription: 'Отказ', state: 's1' })
  expect(location.replace).toHaveBeenCalledWith('./#/settings/sync')
})

test('oauth.html без данных входа показывает текст и ссылку назад', () => {
  const { stored, location } = runOauthPage('')
  expect(stored.size).toBe(0)
  expect(location.replace).not.toHaveBeenCalled()
  expect(document.body.textContent).toContain('Яндекс не вернул данные входа')
  expect(document.querySelector('a')!.getAttribute('href')).toBe('./#/settings/sync')
})
