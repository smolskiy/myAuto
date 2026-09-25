import { expect, test } from '@playwright/test'

/**
 * Сборка под GitHub Pages (`VITE_BASE=/myAuto/`): приложение живёт в подпапке, и всё — манифест, service worker,
 * страница входа в Яндекс — должно работать оттуда. baseURL проекта `pages-base` — `http://localhost:<порт>/myAuto/`,
 * поэтому пути здесь относительные.
 */

const BASE_PATH = '/myAuto/'

test('главная из подпапки открывается и ведёт на онбординг', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveURL(new RegExp(`${BASE_PATH}#/onboarding$`))
  await expect(page.getByRole('heading', { level: 1, name: 'Добро пожаловать' })).toBeVisible()
})

test('манифест отдаётся из подпапки, start_url, scope и иконки — внутри неё', async ({ page, request }) => {
  await page.goto('./')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).not.toBeNull()
  const manifestUrl = new URL(href!, page.url())
  expect(manifestUrl.pathname).toBe(`${BASE_PATH}manifest.webmanifest`)

  const res = await request.get(manifestUrl.href)
  expect(res.status()).toBe(200)
  const manifest = (await res.json()) as {
    start_url: string
    scope: string
    icons: { src: string }[]
  }
  expect(new URL(manifest.start_url, manifestUrl).pathname).toBe(BASE_PATH)
  expect(new URL(manifest.scope, manifestUrl).pathname).toBe(BASE_PATH)
  expect(manifest.icons.length).toBeGreaterThan(0)
  for (const icon of manifest.icons) {
    const iconUrl = new URL(icon.src, manifestUrl)
    expect(iconUrl.pathname.startsWith(BASE_PATH)).toBe(true)
    expect((await request.get(iconUrl.href)).status(), icon.src).toBe(200)
  }
})

test('service worker регистрируется со scope подпапки', async ({ page }) => {
  await page.goto('./')
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    return { scope: reg.scope, script: reg.active?.scriptURL ?? '' }
  })
  expect(new URL(sw.scope).pathname).toBe(BASE_PATH)
  expect(new URL(sw.script).pathname.startsWith(BASE_PATH)).toBe(true)
})

test('oauth.html отвечает из подпапки и не подменяется приложением', async ({ page, request }) => {
  const res = await request.get('oauth.html')
  expect(res.status()).toBe(200)

  // После установки service worker переход на oauth.html не должен уходить в index.html (navigateFallback).
  // С параметром адрес не совпадает с precache — ответ решает именно navigateFallbackDenylist.
  await page.goto('./')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.goto('oauth.html?from=yandex')
  await expect(page).toHaveTitle('Мой авто — вход в Яндекс')
  await expect(page.getByText('Яндекс не вернул данные входа. Попробуйте войти ещё раз.')).toBeVisible()
  const back = page.getByRole('link', { name: 'Вернуться в приложение' })
  const backHref = await back.getAttribute('href')
  expect(new URL(backHref!, page.url()).pathname).toBe(BASE_PATH)
})
