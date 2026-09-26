import { expect, test } from '@playwright/test'
import { onboard, startRecord } from './helpers'

test('справочник СТО: город, поиск, звонок и карта, «Добавить в мои места»', async ({ page }) => {
  await onboard(page)
  await page.goto('./#/places')
  await page.getByRole('button', { name: /Справочник СТО/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Справочник СТО' })).toBeVisible()
  await expect(page.getByText('Выберите город')).toBeVisible()

  await page.getByRole('combobox', { name: 'Город' }).selectOption('Ростов-на-Дону')
  await page.getByRole('searchbox', { name: 'Название или улица' }).fill('пихтин нансена')
  await page.getByRole('button', { name: /ПихтинАвто/ }).click()

  const sheet = page.getByRole('dialog', { name: 'ПихтинАвто' })
  await expect(sheet.getByRole('link', { name: /ул\. Нансена, 156А/ })).toHaveAttribute('target', '_blank')
  await expect(sheet.getByRole('link', { name: /\+7 \(863\) 200-77-88/ })).toHaveAttribute(
    'href',
    'tel:+78632007788',
  )
  await sheet.getByRole('button', { name: 'Добавить в мои места' }).click()
  await expect(page).toHaveURL(/#\/places\/[^/]+$/)
  await expect(page.getByLabel('Адрес', { exact: true })).toHaveValue('ул. Нансена, 156А')
  await expect(page.getByLabel('Телефон', { exact: true })).toHaveValue('+7 (863) 200-77-88')
})

test('город выбран в настройках — поле «Место» в ТО подсказывает СТО из справочника', async ({ page }) => {
  await onboard(page)
  await page.goto('./#/settings')
  await page.getByRole('combobox', { name: 'Город' }).selectOption('Евпатория')

  await page.goto('./')
  await startRecord(page, 'ТО и ремонт')
  await page.getByLabel('Название', { exact: true }).fill('Замена масла')
  await page.getByLabel('Место', { exact: true }).fill('автолидер победы')
  await page.getByRole('option', { name: /Автолидер, просп\. Победы, 75/ }).click()
  await expect(page.getByLabel('Место', { exact: true })).toHaveValue('Автолидер')
  await page.getByLabel('Стоимость', { exact: true }).fill('3500')
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page).toHaveURL(/#\/record\/[^/]+$/)
  await expect(page.getByText('Автолидер')).toBeVisible()
})
