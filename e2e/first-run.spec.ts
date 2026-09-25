import { expect, test } from '@playwright/test'
import { expectHome, nb, onboard, tabBar, upcomingSection } from './helpers'

/** Стартовые напоминания онбординга — в порядке экрана (`STARTER_REMINDER_ITEM_IDS`). */
const STARTER_REMINDERS = [
  'Моторное масло',
  'Масляный фильтр',
  'Воздушный фильтр',
  'Салонный фильтр',
  'Свечи зажигания',
  'Тормозная жидкость',
  'Охлаждающая жидкость',
  'Ремень ГРМ с роликами',
]

test('первый запуск: VIN → машина → все стартовые напоминания → «Позже» → главная с машиной и «Скоро»', async ({
  page,
}) => {
  // Чистый профиль: любой адрес ведёт на онбординг, нижней панели нет.
  await page.goto('./')
  await expect(page).toHaveURL(/#\/onboarding$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Добро пожаловать' })).toBeVisible()
  await expect(page.getByText('Шаг 1 из 3')).toBeVisible()
  await expect(tabBar(page)).toHaveCount(0)

  // Шаг 1: VIN → офлайн-расшифровка → «Заполнить» даёт марку и год.
  await page.getByLabel('VIN', { exact: true }).fill('XTA210990Y2765432')
  await expect(page.getByText('Lada · Россия · 2000')).toBeVisible()
  await page.getByRole('button', { name: 'Заполнить' }).click()
  await expect(page.getByLabel('Марка', { exact: true })).toHaveValue('Lada')
  await expect(page.getByLabel('Год', { exact: true })).toHaveValue('2000')

  await page.getByLabel('Модель', { exact: true }).fill('2109')
  await page.getByLabel('Пробег при покупке', { exact: true }).fill('148000')
  await page.getByRole('button', { name: 'Дальше' }).click()

  // Шаг 2: все стартовые напоминания отмечены — оставляем все.
  await expect(page.getByRole('heading', { level: 1, name: 'Что напоминать' })).toBeVisible()
  await expect(page.getByText('Шаг 2 из 3')).toBeVisible()
  for (const name of STARTER_REMINDERS) {
    await expect(page.getByRole('checkbox', { name, exact: true }), name).toBeChecked()
  }
  await expect(page.getByRole('checkbox')).toHaveCount(STARTER_REMINDERS.length)
  await page.getByRole('button', { name: 'Дальше' }).click()

  // Шаг 3: Диск — позже.
  await expect(page.getByRole('heading', { level: 1, name: 'Синхронизация' })).toBeVisible()
  await expect(page.getByText('Шаг 3 из 3')).toBeVisible()
  await page.getByRole('button', { name: 'Позже' }).click()

  // Главная: карточка машины и «Скоро» с тремя ближайшими напоминаниями.
  await expectHome(page)
  await expect(page.getByRole('button', { name: 'Lada 2109, сменить машину' })).toBeVisible()
  await expect(page.getByText('Lada 2109 2000', { exact: true })).toBeVisible()
  await expect(page.getByText(nb('148 000 км'), { exact: true })).toBeVisible()

  const soon = upcomingSection(page)
  await expect(soon.getByRole('heading', { name: 'Скоро' })).toBeVisible()
  await expect(soon.getByRole('listitem')).toHaveCount(3)
  for (const card of await soon.getByRole('listitem').all()) {
    const title = (await card.getByRole('button').first().textContent()) ?? ''
    expect(STARTER_REMINDERS, `«${title}» — из стартовых`).toContain(title)
  }

  // Онбординг пройден: после перезагрузки редиректа больше нет.
  await page.reload()
  await expectHome(page)
  await expect(page.getByRole('button', { name: 'Lada 2109, сменить машину' })).toBeVisible()
})

// DEF-02 (docs/qa/2026-09-25-e2e.md): короткое имя «Lada 2109» на карточке главной обрезалось до «Lada 2…»,
// хотя справа от него пустое место.
test('DEF-02: имя машины на карточке главной видно целиком', async ({ page }) => {
  await onboard(page)
  const name = page
    .getByRole('button', { name: 'Lada 2109, сменить машину' })
    .getByText('Lada 2109', { exact: true })
  await expect(name).toBeVisible()
  const width = await name.evaluate((el) => ({ text: el.scrollWidth, box: el.clientWidth }))
  expect(width.text, 'ширина текста имени не больше ширины его места — без многоточия').toBeLessThanOrEqual(
    width.box,
  )
})

test('DEF-02: длинное имя машины обрезается многоточием в пределах карточки', async ({ page }) => {
  await onboard(page, { make: 'Mercedes-Benz', model: 'GLE 450 4MATIC Coupe AMG Line Premium Plus' })
  const button = page.getByRole('button', { name: /^Mercedes-Benz GLE .*, сменить машину$/ })
  await expect(button).toBeVisible()
  const box = await button.evaluate((el) => {
    const card = el.closest('[class*="card"]')!.getBoundingClientRect()
    const own = el.getBoundingClientRect()
    const name = el.querySelector('span')!
    return { right: own.right, cardRight: card.right, text: name.scrollWidth, room: name.clientWidth }
  })
  expect(box.text, 'имя шире своего места — обрезано').toBeGreaterThan(box.room)
  expect(box.right, 'кнопка имени не вылезает за карточку').toBeLessThanOrEqual(box.cardRight)
})

// DEF-03 (docs/qa/2026-09-25-e2e.md): редирект на онбординг считается переходом — оболочка переводит фокус на h1,
// и на первом же экране у «Добро пожаловать» синяя рамка фокуса.
test.fixme('DEF-03: на первом запуске заголовок онбординга без рамки фокуса', async ({ page }) => {
  await page.goto('./')
  const heading = page.getByRole('heading', { level: 1, name: 'Добро пожаловать' })
  await expect(heading).toBeVisible()
  // Фокус ставится эффектом после отрисовки — даём ему два кадра.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await expect(heading).toHaveCSS('outline-style', 'none')
})

// DEF-04 (docs/qa/2026-09-25-e2e.md): «Назад» на первом шаге онбординга некуда вести — экран пересоздаётся
// редиректом, и введённое в форму машины пропадает.
test.fixme('DEF-04: «Назад» на первом шаге онбординга не стирает введённое', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1, name: 'Добро пожаловать' })).toBeVisible()
  await page.getByLabel('Марка', { exact: true }).fill('Lada')
  const back = page.getByRole('button', { name: 'Назад' })
  // Без кнопки «Назад» на первом экране терять нечего — это тоже исправление.
  if ((await back.count()) > 0) await back.click()
  // Редирект обратно на онбординг проходит без видимых признаков — ждём его с запасом.
  await page.waitForTimeout(500)
  await expect(page.getByRole('heading', { level: 1, name: 'Добро пожаловать' })).toBeVisible()
  await expect(page.getByLabel('Марка', { exact: true })).toHaveValue('Lada')
})
