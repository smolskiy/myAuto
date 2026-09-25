import { expect, test } from '@playwright/test'
import { onboard, pickOption, startRecord } from './helpers'

test('строки ТО: узел из расширенного каталога по нескольким словам и узел, которого в каталоге нет', async ({
  page,
}) => {
  await onboard(page)
  await startRecord(page, 'ТО и ремонт')
  await page.getByLabel('Название', { exact: true }).fill('Подвеска')

  // «рычаг перед лев» находит «Рычаг передний нижний левый».
  await page.getByRole('button', { name: 'Добавить запчасть' }).click()
  const part = page.getByRole('dialog', { name: 'Запчасть' })
  await pickOption(
    part.getByLabel('Узел', { exact: true }),
    'рычаг перед лев',
    /^Рычаг передний нижний левый/,
  )
  await part.getByRole('button', { name: 'Готово' }).click()
  await expect(part).toBeHidden()

  // Узла нет в каталоге: набранное становится названием работы, строка не пропадает.
  await page.getByRole('button', { name: 'Добавить работу' }).click()
  const work = page.getByRole('dialog', { name: 'Работа' })
  await work.getByLabel('Узел', { exact: true }).fill('Замена кривого болта')
  await work.getByRole('button', { name: 'Готово' }).click()
  await expect(work).toBeHidden()

  await expect(
    page.getByRole('region', { name: 'Запчасти' }).getByText('Рычаг передний нижний левый'),
  ).toBeVisible()
  await expect(page.getByRole('region', { name: 'Работы' }).getByText('Замена кривого болта')).toBeVisible()
})
