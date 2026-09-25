import { expect, test } from '@playwright/test'

test('главная открывается и навигация ведёт в журнал', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1, name: 'Главная' })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Основная навигация' })
    .getByRole('link', { name: 'Журнал' })
    .click()
  await expect(page).toHaveURL(/#\/journal$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Журнал' })).toBeVisible()
})

test('глубокая ссылка открывается напрямую', async ({ page }) => {
  await page.goto('./#/settings/sync')
  await expect(page.getByRole('heading', { level: 1, name: 'Синхронизация' })).toBeVisible()
})
