import { expect, test } from '@playwright/test'
import { expectHome, onboard, tabBar } from './helpers'

// Система — светлая: тёмная тема на экране может взяться только из выбора в настройках.
test.use({ colorScheme: 'light' })

test('тема: «Ещё → Настройки → Тема → Тёмная» включает тёмную, она остаётся после перезагрузки', async ({
  page,
}) => {
  await onboard(page)
  const html = page.locator('html')
  await expect(html).toHaveAttribute('data-theme', 'light')

  await tabBar(page).getByRole('link', { name: 'Ещё' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Ещё' })).toBeVisible()
  await page.getByRole('button', { name: 'Настройки' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Настройки' })).toBeVisible()

  const theme = page.getByRole('radiogroup', { name: 'Тема' })
  await expect(theme.getByRole('radio', { name: 'Как в системе' })).toBeChecked()
  await theme.getByRole('radio', { name: 'Тёмная' }).click()

  await expect(html).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0E0F11')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(14, 15, 17)')

  // После перезагрузки — та же тема и тот же выбор, причём уже до первого рендера (без светлой вспышки):
  // запоминаем тему в момент появления <body>, когда отработал только скрипт из <head>.
  await page.addInitScript(() => {
    new MutationObserver((_, observer) => {
      if (!document.body) return
      ;(window as { themeAtBody?: string }).themeAtBody = document.documentElement.dataset.theme
      observer.disconnect()
    }).observe(document, { childList: true, subtree: true })
  })
  await page.reload()
  expect(await page.evaluate(() => (window as { themeAtBody?: string }).themeAtBody)).toBe('dark')
  await expect(page.getByRole('heading', { level: 1, name: 'Настройки' })).toBeVisible()
  await expect(html).toHaveAttribute('data-theme', 'dark')
  await expect(theme.getByRole('radio', { name: 'Тёмная' })).toBeChecked()

  // И на главной после перезагрузки с неё.
  await tabBar(page).getByRole('link', { name: 'Главная' }).click()
  await expectHome(page)
  await page.reload()
  await expectHome(page)
  await expect(html).toHaveAttribute('data-theme', 'dark')
})
