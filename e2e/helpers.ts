import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Общие шаги сквозных сценариев. Каждый тест Playwright и так получает чистый контекст браузера (пустые IndexedDB,
 * localStorage, без service worker) — «чистый профиль» есть с первого шага. `clearAppData` нужен, когда профиль надо
 * стереть посреди сценария (копия → «новое устройство»).
 */

/** Неразрывный пробел: приложение ставит его в разряды и перед единицей («148 000 км», «5 450 ₽»). */
export const NBSP = ' '

/** «148 000 км» / «5 450 ₽» / «7,6 л/100 км» — как их пишет приложение. */
export const nb = (text: string) => text.replaceAll(' ', NBSP)

/** Имя базы приложения (Dexie). */
const DB_NAME = 'myauto'

/** Нижняя панель. */
export const tabBar = (page: Page) => page.getByRole('navigation', { name: 'Основная навигация' })

/** Главная: адрес, заголовок и активная вкладка. */
export async function expectHome(page: Page) {
  await expect(page).toHaveURL(/\/(#\/)?$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Мой авто' })).toBeVisible()
  await expect(tabBar(page).getByRole('link', { name: 'Главная' })).toHaveAttribute('aria-current', 'page')
}

/** Раздел «Скоро» на главной. */
export const upcomingSection = (page: Page) => page.getByRole('region', { name: 'Скоро' })

/** Строка напоминания в «Скоро» по названию узла. */
export const upcomingCard = (page: Page, title: string): Locator =>
  upcomingSection(page)
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: title }) })

/**
 * Стереть данные приложения посреди сценария: уходим со страниц приложения на его же статичный файл (соединений
 * с базой не остаётся), удаляем базу и localStorage. Service worker остаётся — как у человека, который очистил
 * данные сайта, но приложение уже установлено.
 */
export async function clearAppData(page: Page) {
  await page.goto('./manifest.webmanifest')
  await page.evaluate(async (name) => {
    localStorage.clear()
    sessionStorage.clear()
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(name)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }, DB_NAME)
}

/** Первый шаг онбординга: пишет марку и модель, остальное из опций. */
export interface VehicleInput {
  make?: string
  model?: string
  /** Пробег при покупке — единственный пробег в форме машины; главная берёт его как текущий, пока нет записей. */
  odometer?: number
}

/**
 * Быстрый первый запуск для сценариев, которые проверяют не онбординг: машина (марка, модель, пробег) → все
 * стартовые напоминания → «Позже» → главная. Сам онбординг подробно проверяет `first-run.spec.ts`.
 */
export async function onboard(page: Page, vehicle: VehicleInput = {}) {
  const { make = 'Lada', model = '2109', odometer = 148_000 } = vehicle
  await page.goto('./')
  await expect(page).toHaveURL(/#\/onboarding$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Добро пожаловать' })).toBeVisible()
  await page.getByLabel('Марка', { exact: true }).fill(make)
  await page.getByLabel('Модель', { exact: true }).fill(model)
  await page.getByLabel('Пробег при покупке', { exact: true }).fill(String(odometer))
  await page.getByRole('button', { name: 'Дальше' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Что напоминать' })).toBeVisible()
  await page.getByRole('button', { name: 'Дальше' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Синхронизация' })).toBeVisible()
  await page.getByRole('button', { name: 'Позже' }).click()
  await expectHome(page)
}

/** «+» нижней панели → вид записи в шторке «Новая запись». */
export async function startRecord(
  page: Page,
  kind: 'ТО и ремонт' | 'Заправка' | 'Расход' | 'Пробег' | 'Заметка',
) {
  await tabBar(page).getByRole('button', { name: 'Добавить запись' }).click()
  const sheet = page.getByRole('dialog', { name: 'Новая запись' })
  await sheet.getByRole('button', { name: kind, exact: true }).click()
}

/** Выбрать вариант комбобокса по видимой подписи (сначала набираем текст, потом жмём строку списка). */
export async function pickOption(field: Locator, query: string, option: string | RegExp) {
  await field.fill(query)
  const page = field.page()
  await page.getByRole('option', { name: option }).click()
}

export interface FillInput {
  day?: 'Сегодня' | 'Вчера'
  odometer: string
  liters: string
  pricePerLiter: string
}

/** «+» → «Заправка»: дата чипом, пробег, литры и цена (сумма считается сама), полный бак по умолчанию → карточка. */
export async function addFill(page: Page, fill: FillInput) {
  await startRecord(page, 'Заправка')
  await expect(page.getByRole('heading', { level: 1, name: 'Заправка' })).toBeVisible()
  await page.getByRole('button', { name: fill.day ?? 'Сегодня', exact: true }).click()
  await page.getByLabel('Пробег', { exact: true }).fill(fill.odometer)
  await page.getByLabel('Литры', { exact: true }).fill(fill.liters)
  await page.getByLabel('Цена за литр', { exact: true }).fill(fill.pricePerLiter)
  await expect(page.getByRole('switch', { name: 'Полный бак' })).toBeChecked()
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page).toHaveURL(/#\/record\/[^/]+$/)
}

/** «+» → «ТО и ремонт» с названием и новым местом, без строк; итог вводится вручную → карточка. */
export async function addService(page: Page, input: { title: string; place: string; total: string }) {
  await startRecord(page, 'ТО и ремонт')
  await expect(page.getByRole('heading', { level: 1, name: 'ТО и ремонт' })).toBeVisible()
  await page.getByLabel('Название', { exact: true }).fill(input.title)
  await page.getByLabel('Место', { exact: true }).fill(input.place)
  await page.getByRole('option', { name: `Создать «${input.place}»` }).click()
  await expect(page.getByLabel('Место', { exact: true })).toHaveValue(input.place)
  await page.getByLabel('Итого', { exact: true }).fill(input.total)
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await expect(page).toHaveURL(/#\/record\/[^/]+$/)
}
