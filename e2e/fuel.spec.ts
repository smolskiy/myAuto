import { expect, test } from '@playwright/test'
import { addFill, expectHome, nb, onboard, tabBar } from './helpers'

test('две полные заправки: расход 7,6 л/100 км на карточке, на главной и в статистике', async ({ page }) => {
  await onboard(page) // пробег при покупке 148 000 км

  await addFill(page, { day: 'Вчера', odometer: '148000', liters: '40', pricePerLiter: '60' })
  await expect(page.getByText(nb('2 400 ₽')).first()).toBeVisible()

  // 38 л на 500 км между полными баками = 7,6 л/100 км.
  await addFill(page, { day: 'Сегодня', odometer: '148500', liters: '38', pricePerLiter: '60' })
  const consumption = nb('7,6 л/100 км')
  await expect(page.getByText(consumption, { exact: true })).toBeVisible()

  // Главная: плитка «Расход топлива».
  await tabBar(page).getByRole('link', { name: 'Главная' }).click()
  await expectHome(page)
  await expect(page.getByRole('button', { name: /^Расход топлива/ })).toContainText(consumption)

  // Статистика: «Средний расход».
  await tabBar(page).getByRole('link', { name: 'Ещё' }).click()
  await page.getByRole('button', { name: 'Статистика' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Статистика' })).toBeVisible()
  await expect(page.getByText('Средний расход', { exact: true })).toBeVisible()
  await expect(page.getByText(consumption, { exact: true }).first()).toBeVisible()
})
