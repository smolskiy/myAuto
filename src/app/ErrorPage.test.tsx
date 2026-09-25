import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../db/instance'
import { repos } from '../db/repos'
import { AppProviders } from './providers'
import { reloadPage } from './reload'
import { createAppRouter } from './routes'

vi.mock('./reload', () => ({ reloadPage: vi.fn() }))

// Страница журнала падает при рендере, страница статистики — как после выхода новой версии (чанк не найден).
vi.mock('../features/journal/JournalPage', () => ({
  default: () => {
    throw new Error('Сломалось при отрисовке')
  },
}))
vi.mock('../features/stats/StatsPage', () => ({
  default: () => {
    throw new TypeError('Failed to fetch dynamically imported module: https://x/assets/StatsPage-1a2b.js')
  },
}))

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

beforeEach(async () => {
  await db.open()
  await repos.vehicles.create({
    name: 'Октавия',
    make: 'Skoda',
    model: 'Octavia',
    archived: false,
    fluids: [],
    order: 0,
  })
  sessionStorage.clear()
  vi.mocked(reloadPage).mockClear()
  // React и роутер сообщают о пойманной ошибке в консоль — в тесте это ожидаемо.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

test('ошибка экрана — русская страница ошибки с текстом и действиями', async () => {
  const router = renderAt('/journal')
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Что-то пошло не так' }, LAZY),
  ).toBeInTheDocument()
  expect(screen.getByText('Сломалось при отрисовке')).toBeInTheDocument()
  expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Перезагрузить' }))
  expect(reloadPage).toHaveBeenCalledOnce()

  await userEvent.click(screen.getByRole('button', { name: 'На главную' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/'))
})

test('чанк новой версии не загрузился — одна автоматическая перезагрузка', async () => {
  renderAt('/stats')
  await waitFor(() => expect(reloadPage).toHaveBeenCalledOnce(), LAZY)
})

test('после автоматической перезагрузки ошибка чанка показывается, без новой перезагрузки', async () => {
  renderAt('/stats')
  await waitFor(() => expect(reloadPage).toHaveBeenCalledOnce(), LAZY)
  // «Перезагрузка» случилась (sessionStorage живёт), а чанк так и не нашёлся.
  cleanup()
  vi.mocked(reloadPage).mockClear()
  renderAt('/stats')
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Что-то пошло не так' }, LAZY),
  ).toBeInTheDocument()
  expect(reloadPage).not.toHaveBeenCalled()
})
