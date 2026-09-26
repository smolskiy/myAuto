import { expect, test, type Page } from '@playwright/test'
import { expectHome, nb, onboard, pickOption, startRecord, tabBar, upcomingCard } from './helpers'

interface PartInput {
  item: string
  brand: string
  partNumber?: string
  qty?: string
  unit?: string
  price: string
}

/** «Добавить запчасть» → шторка «Запчасть»: узел из каталога, бренд, артикул, количество, цена → «Готово». */
async function addPart(page: Page, part: PartInput) {
  await page.getByRole('button', { name: 'Добавить запчасть' }).click()
  const sheet = page.getByRole('dialog', { name: 'Запчасть' })
  await expect(sheet).toBeVisible()
  await pickOption(sheet.getByLabel('Узел', { exact: true }), part.item, part.item)
  await sheet.getByLabel('Бренд', { exact: true }).fill(part.brand)
  if (part.partNumber) await sheet.getByLabel('Артикул', { exact: true }).fill(part.partNumber)
  if (part.qty) await sheet.getByLabel('Количество', { exact: true }).fill(part.qty)
  if (part.unit) await sheet.getByLabel('Единица', { exact: true }).selectOption({ label: part.unit })
  await sheet.getByLabel(/^Цена за /).fill(part.price)
  await sheet.getByRole('button', { name: 'Готово' }).click()
  await expect(sheet).toBeHidden()
}

test('ТО с тремя запчастями: итог, карточка записи, напоминание о масле и подсказка «В прошлый раз»', async ({
  page,
}) => {
  await onboard(page) // Lada 2109, 148 000 км, все стартовые напоминания

  // «+» → «ТО и ремонт».
  await startRecord(page, 'ТО и ремонт')
  await expect(page.getByRole('heading', { level: 1, name: 'ТО и ремонт' })).toBeVisible()
  await expect(tabBar(page)).toBeHidden()

  await page.getByLabel('Название', { exact: true }).fill('ТО-15')
  // Пробег предзаполнен последним известным.
  await expect(page.getByLabel('Пробег', { exact: true })).toHaveValue(nb('148 000'))

  // Место — новое, создаётся из комбобокса.
  const place = page.getByLabel('Место', { exact: true })
  await place.fill('Автосервис')
  await page.getByRole('option', { name: 'Создать «Автосервис»' }).click()
  await expect(place).toHaveValue('Автосервис')

  // Форма короткая: строки — по «Расписать работы и запчасти».
  await expect(page.getByRole('button', { name: 'Добавить запчасть' })).toBeHidden()
  await page.getByRole('button', { name: 'Расписать работы и запчасти' }).click()
  await addPart(page, {
    item: 'Моторное масло',
    brand: 'Motul',
    qty: '4',
    unit: 'л',
    price: '900',
  })
  await addPart(page, {
    item: 'Масляный фильтр',
    brand: 'Mann-Filter',
    partNumber: 'W 712/95',
    price: '650',
  })
  await addPart(page, { item: 'Воздушный фильтр', brand: 'Mahle', price: '1200' })

  // Три строки и итог 4 × 900 + 650 + 1 200 = 5 450 ₽.
  const parts = page.getByRole('region', { name: 'Запчасти' })
  await expect(parts.getByRole('listitem')).toHaveCount(3)
  await expect(parts.getByText(nb('5 450 ₽'), { exact: true })).toBeVisible()
  await expect(page.getByLabel('Стоимость', { exact: true })).toHaveValue(nb('5 450'))

  await page.getByRole('button', { name: 'Сохранить' }).click()

  // Карточка записи: название, итог, запчасти с брендами и артикулом.
  await expect(page).toHaveURL(/#\/record\/[^/]+$/)
  await expect(page.getByRole('heading', { level: 2, name: 'ТО-15' })).toBeVisible()
  await expect(page.getByText('Автосервис', { exact: true })).toBeVisible()
  await expect(page.getByText(nb('Motul · 4 л'), { exact: true })).toBeVisible()
  await expect(page.getByText(nb('Mann-Filter · W 712/95 · 1 шт'), { exact: true })).toBeVisible()
  await expect(page.getByText(nb('Mahle · 1 шт'), { exact: true })).toBeVisible()
  await expect(page.getByText(nb('3 600 ₽'), { exact: true })).toBeVisible()
  await expect(page.getByText(nb('5 450 ₽')).first()).toBeVisible()

  // Главная: «Моторное масло» в порядке, до замены 10 000 км.
  await tabBar(page).getByRole('link', { name: 'Главная' }).click()
  await expectHome(page)
  const oil = upcomingCard(page, 'Моторное масло')
  await expect(oil).toBeVisible()
  await expect(oil).toContainText('В порядке')
  await expect(oil).toContainText(nb('через 10 000 км'))

  // Вторая запись ТО: у масляного фильтра — подсказка из прошлой записи, одно касание заполняет строку.
  await startRecord(page, 'ТО и ремонт')
  await page.getByRole('button', { name: 'Расписать работы и запчасти' }).click()
  await page.getByRole('button', { name: 'Добавить запчасть' }).click()
  const sheet = page.getByRole('dialog', { name: 'Запчасть' })
  await pickOption(sheet.getByLabel('Узел', { exact: true }), 'Масляный', 'Масляный фильтр')
  const hint = sheet.getByRole('button', { name: nb('В прошлый раз: Mann-Filter W 712/95, 650 ₽') })
  await expect(hint).toBeVisible()
  await hint.click()
  await expect(sheet.getByLabel('Бренд', { exact: true })).toHaveValue('Mann-Filter')
  await expect(sheet.getByLabel('Артикул', { exact: true })).toHaveValue('W 712/95')
  await expect(sheet.getByLabel('Цена за шт', { exact: true })).toHaveValue('650')
})
