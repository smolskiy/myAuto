import { expect, test } from '@playwright/test'
import { expectHome, onboard } from './helpers'

test('Октавия: на карточке машины — чертёж, нажатие ведёт к напоминаниям', async ({ page }) => {
  // Картинка чертежа реально приходит (высоту слою даёт aspect-ratio и без неё).
  const art = page.waitForResponse((r) => /octavia-a5[^/]*\.webp$/.test(new URL(r.url()).pathname))
  await onboard(page, { make: 'Skoda', model: 'Octavia' })
  await expectHome(page)

  const schematic = page.getByRole('button', { name: /^Схема машины/ })
  await expect(schematic).toBeVisible()
  expect((await art).ok()).toBe(true)

  await schematic.click()
  await expect(page).toHaveURL(/#\/reminders$/)
})

test('машина без чертежа — карточка как раньше', async ({ page }) => {
  await onboard(page)
  await expectHome(page)
  await expect(page.getByRole('button', { name: 'Lada 2109, сменить машину' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Схема машины/ })).toHaveCount(0)
})
