import { expect, test } from '@playwright/test'
import { addFill, addService, expectHome, nb, onboard, tabBar } from './helpers'

test('без сети: после первого визита приложение открывается из кеша, главная и журнал с данными', async ({
  page,
  context,
}) => {
  await onboard(page)
  await addService(page, { title: 'ТО-15', place: 'Автосервис', total: '5450' })
  await addFill(page, { odometer: '148500', liters: '38', pricePerLiter: '60' })

  // Service worker установлен и закешировал приложение.
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope)
  expect(new URL(scope).pathname).toBe('/')

  await tabBar(page).getByRole('link', { name: 'Главная' }).click()
  await expectHome(page)

  await context.setOffline(true)
  await page.reload()
  // Страницу отдал service worker, а не сеть.
  expect(await page.evaluate(() => navigator.onLine)).toBe(false)
  expect(await page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)

  // Главная: машина, пробег последней записи, последние записи.
  await expectHome(page)
  await expect(page.getByRole('button', { name: 'Lada 2109, сменить машину' })).toBeVisible()
  await expect(page.getByRole('definition').filter({ hasText: nb('148 500 км') })).toBeVisible()
  const recent = page.getByRole('region', { name: 'Последние записи' })
  await expect(recent.getByText('ТО-15', { exact: true })).toBeVisible()
  await expect(recent.getByText(nb('Заправка · 38 л'), { exact: true })).toBeVisible()

  // Журнал без сети — обе записи.
  await tabBar(page).getByRole('link', { name: 'Журнал' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Журнал' })).toBeVisible()
  await expect(page.getByText('ТО-15', { exact: true })).toBeVisible()
  await expect(page.getByText(nb('Заправка · 38 л'), { exact: true })).toBeVisible()
  await expect(page.getByText(nb('5 450 ₽'), { exact: true }).first()).toBeVisible()

  // Перезагрузка прямо на журнале, всё ещё без сети.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Журнал' })).toBeVisible()
  await expect(page.getByText('ТО-15', { exact: true })).toBeVisible()
  await expect(page.getByText(nb('Заправка · 38 л'), { exact: true })).toBeVisible()

  // И запись, внесённая без сети, сохраняется и видна.
  await addFill(page, { odometer: '148900', liters: '31', pricePerLiter: '60' })
  await tabBar(page).getByRole('link', { name: 'Журнал' }).click()
  await expect(page.getByText(nb('Заправка · 31 л'), { exact: true })).toBeVisible()
})
