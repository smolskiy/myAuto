import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router'
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../db/instance'
import { repos } from '../db/repos'
import { AppProviders } from './providers'
import { createAppRouter } from './routes'

const LAZY = { timeout: 5000 }

const renderAt = (path: string) => {
  const router = createAppRouter({ initialPath: path })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return router
}
const addVehicle = (archived = false) =>
  repos.vehicles.create({ name: 'Октавия', make: 'Skoda', model: 'Octavia', archived, fluids: [], order: 0 })

// Холодный импорт тяжёлой витрины под нагрузкой полного прогона бывает дольше 5 с — прогреваем заранее.
beforeAll(() => import('../ui/showcase/ShowcasePage'), 60_000)
/**
 * Витрина рисует все секции с графиками: даже с прогретым модулем рендер в jsdom идёт секунды, а под нагрузкой
 * полного прогона — дольше 5 с. Запас — только этому тесту; поломку витрины он всё равно поймает (не будет h1).
 */
const SHOWCASE_TEST_MS = 20_000
const SHOWCASE = { timeout: 15_000 }

beforeEach(async () => {
  await db.open()
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  document.documentElement.style.removeProperty('--toast-offset')
})

test('кнопка «+» открывает выбор типа записи и ведёт в форму заправки', async () => {
  await addVehicle()
  const router = renderAt('/')
  await userEvent.click(await screen.findByRole('button', { name: 'Добавить запись' }))
  // ActionSheet из src/ui рисует действия кнопками в списке внутри диалога (не menuitem).
  const sheet = await screen.findByRole('dialog', { name: 'Новая запись' })
  const names = within(within(sheet).getByRole('list'))
    .getAllByRole('button')
    .map((b) => b.textContent)
  expect(names).toEqual(['ТО и ремонт', 'Заправка', 'Расход', 'Пробег', 'Заметка'])
  await userEvent.click(within(sheet).getByRole('button', { name: 'Заправка' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/record/new/fuel'))
})

test('нижняя панель: четыре раздела, активный отмечен', async () => {
  await addVehicle()
  renderAt('/journal')
  const nav = await screen.findByRole('navigation', { name: 'Основная навигация' })
  const links = within(nav).getAllByRole('link')
  expect(links.map((l) => l.textContent)).toEqual(['Главная', 'Журнал', 'ТО', 'Ещё'])
  expect(within(nav).getByRole('link', { name: 'Журнал' })).toHaveAttribute('aria-current', 'page')
  expect(within(nav).getByRole('link', { name: 'Главная' })).not.toHaveAttribute('aria-current')
})

test('страницы раздела «Ещё» подсвечивают вкладку «Ещё»', async () => {
  await addVehicle()
  renderAt('/stats')
  const nav = await screen.findByRole('navigation', { name: 'Основная навигация' })
  expect(within(nav).getByRole('link', { name: 'Ещё' })).toHaveAttribute('aria-current', 'page')
})

test('на формах нижней панели нет', async () => {
  await addVehicle()
  renderAt('/record/new/fuel')
  await screen.findByRole('main')
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Добавить запись' })).not.toBeInTheDocument(),
  )
})

test.each([
  '/record/new/service',
  '/record/r1/edit',
  '/vehicle/new',
  '/vehicle/v1/edit',
  '/reminders/new',
  '/reminders/r1',
  '/documents/new',
  '/tires/new',
  '/places/new',
  '/masters/new',
  '/onboarding',
])('форма %s — без панели, уведомления не над панелью', async (path) => {
  await addVehicle()
  renderAt(path)
  await screen.findByRole('main')
  expect(screen.queryByRole('navigation', { name: 'Основная навигация' })).not.toBeInTheDocument()
  // 0px у заглушки; когда экран станет FormPage — высота её кнопки «Сохранить» (см. formMode.test.tsx).
  expect(document.documentElement.style.getPropertyValue('--toast-offset')).not.toBe('')
})

test.each(['/', '/journal', '/reminders', '/more', '/stats', '/garage', '/places', '/settings'])(
  'раздел %s — с панелью',
  async (path) => {
    await addVehicle()
    renderAt(path)
    expect(await screen.findByRole('navigation', { name: 'Основная навигация' })).toBeInTheDocument()
    expect(document.documentElement.style.getPropertyValue('--toast-offset')).toBe('')
  },
)

test('пока машины не загружены — ни панели, ни экрана (нет мелькания перед онбордингом)', async () => {
  await addVehicle()
  renderAt('/journal')
  // Первая отрисовка: живой запрос машин ещё не ответил.
  expect(screen.queryByRole('navigation', { name: 'Основная навигация' })).not.toBeInTheDocument()
  expect(screen.getByRole('main')).toBeEmptyDOMElement()
  expect(await screen.findByRole('navigation', { name: 'Основная навигация' })).toBeInTheDocument()
})

test('настройки без машин открываются сразу, с панелью', () => {
  renderAt('/settings')
  expect(screen.getByRole('navigation', { name: 'Основная навигация' })).toBeInTheDocument()
})

test('заголовок вкладки браузера — название экрана', async () => {
  await addVehicle()
  const router = renderAt('/journal')
  await waitFor(() => expect(document.title).toBe('Журнал — Мой авто'))
  await act(() => router.navigate('/stats'))
  await waitFor(() => expect(document.title).toBe('Статистика — Мой авто'))
  await act(() => router.navigate('/nope'))
  await waitFor(() => expect(document.title).toBe('Страница не найдена — Мой авто'))
})

test('после перехода фокус — на заголовке нового экрана (скринридер объявит его)', async () => {
  await addVehicle()
  renderAt('/')
  const nav = await screen.findByRole('navigation', { name: 'Основная навигация' })
  await userEvent.click(within(nav).getByRole('link', { name: 'Журнал' }))
  const h1 = await screen.findByRole('heading', { level: 1, name: 'Журнал' }, LAZY)
  await waitFor(() => expect(h1).toHaveFocus())
  expect(h1).toHaveAttribute('tabindex', '-1')
})

test('без машин — онбординг', async () => {
  const router = renderAt('/journal')
  await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'))
})

test('с машиной — без редиректа, даже если она в архиве', async () => {
  await addVehicle(true)
  const router = renderAt('/journal')
  await screen.findByRole('navigation', { name: 'Основная навигация' })
  await new Promise((r) => setTimeout(r, 50))
  expect(router.state.location.pathname).toBe('/journal')
})

test('настройки доступны и без машин', async () => {
  const router = renderAt('/settings/sync')
  await new Promise((r) => setTimeout(r, 50))
  expect(router.state.location.pathname).toBe('/settings/sync')
})

test('тост новой версии обновляет приложение', async () => {
  await addVehicle()
  renderAt('/')
  const update = vi.fn()
  act(() => {
    window.dispatchEvent(new CustomEvent('pwa:need-refresh', { detail: { update } }))
  })
  expect(await screen.findByText('Доступна новая версия')).toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: 'Обновить' }))
  expect(update).toHaveBeenCalled()
})

test(
  'витрина открывается без машин и без нижней панели',
  async () => {
    const router = renderAt('/showcase')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Витрина компонентов' }, SHOWCASE),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/showcase')
    // В эскизах витрины есть свои панели, поэтому признак скрытой панели оболочки — нулевой отступ уведомлений.
    expect(document.documentElement.style.getPropertyValue('--toast-offset')).toBe('0px')
  },
  SHOWCASE_TEST_MS,
)
