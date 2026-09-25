import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import {
  addFill,
  addService,
  clearAppData,
  expectHome,
  nb,
  onboard,
  tabBar,
  upcomingSection,
} from './helpers'

test('копия: «Выгрузить копию» → чистый профиль → «Загрузить копию» → «Объединить» — записи и справочники на месте', async ({
  page,
}, testInfo) => {
  await onboard(page)
  await addService(page, { title: 'ТО-15', place: 'Автосервис', total: '5450' })
  await addFill(page, { odometer: '148500', liters: '38', pricePerLiter: '60' })

  // «Ещё → Данные и выгрузки → Выгрузить копию (JSON)» — файл скачивается.
  await tabBar(page).getByRole('link', { name: 'Ещё' }).click()
  await page.getByRole('button', { name: 'Данные и выгрузки' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Данные и выгрузки' })).toBeVisible()
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Выгрузить копию (JSON)' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^moy-avto-\d{4}-\d{2}-\d{2}\.json$/)
  const file = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(file)
  const snapshot = JSON.parse(await readFile(file, 'utf8')) as { tables: Record<string, unknown[]> }
  expect(snapshot.tables.vehicles).toHaveLength(1)
  expect(snapshot.tables.records).toHaveLength(2)

  // Данные сайта стёрты: приложение снова на первом запуске.
  await clearAppData(page)
  await page.goto('./')
  await expect(page).toHaveURL(/#\/onboarding$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Добро пожаловать' })).toBeVisible()

  // Экран данных открыт и без машин (настройки не уводят на онбординг). С самого онбординга кнопки туда нет —
  // DEF-01, отдельный тест ниже; здесь заходим по адресу.
  await page.goto('./#/settings/data')
  await expect(page.getByRole('heading', { level: 1, name: 'Данные и выгрузки' })).toBeVisible()

  const choosing = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Загрузить копию' }).click()
  await (await choosing).setFiles(file)
  await expect(
    page.getByText(/^Файл от \d{2}\.\d{2}\.\d{4}: машин 1, записей 2, мест 1, напоминаний 8$/),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Объединить' }).click()
  await expect(page.getByText('Данные из копии объединены с этими')).toBeVisible()

  // Главная: машина, пробег, напоминания и записи.
  await page.goto('./')
  await expectHome(page)
  await expect(page.getByRole('button', { name: 'Lada 2109, сменить машину' })).toBeVisible()
  await expect(page.getByRole('definition').filter({ hasText: nb('148 500 км') })).toBeVisible()
  await expect(upcomingSection(page).getByRole('listitem')).toHaveCount(3)
  const recent = page.getByRole('region', { name: 'Последние записи' })
  await expect(recent.getByText('ТО-15', { exact: true })).toBeVisible()
  await expect(recent.getByText(nb('Заправка · 38 л'), { exact: true })).toBeVisible()

  // Журнал — обе записи.
  await tabBar(page).getByRole('link', { name: 'Журнал' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Журнал' })).toBeVisible()
  await expect(page.getByText('ТО-15', { exact: true })).toBeVisible()
  await expect(page.getByText(nb('Заправка · 38 л'), { exact: true })).toBeVisible()

  // Справочник мест — «Автосервис» на месте.
  await tabBar(page).getByRole('link', { name: 'Ещё' }).click()
  await page.getByRole('button', { name: 'Места и мастера' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Места и мастера' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Автосервис/ })).toBeVisible()
})

// DEF-01 (docs/qa/2026-09-25-e2e.md): на новом устройстве онбординг требует завести машину — ни загрузить копию,
// ни подключить Диск до этого нельзя; после восстановления у владельца оказывается лишняя машина.
test.fixme('DEF-01: с онбординга можно перейти к загрузке копии, не добавляя машину', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveURL(/#\/onboarding$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Добро пожаловать' })).toBeVisible()
  const main = page.getByRole('main')
  // Подпись кнопки не задана планом — любая про копию: «Загрузить копию», «Восстановить из копии»…
  const restore = main.getByRole('button', { name: /копи/i }).or(main.getByRole('link', { name: /копи/i }))
  await expect(restore.first(), 'на онбординге есть вход в загрузку копии').toBeVisible()
  await restore.first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'Данные и выгрузки' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Загрузить копию' })).toBeVisible()
})
