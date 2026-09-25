import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { db } from '../db/instance'
import { repos } from '../db/repos'
import { AppProviders } from './providers'
import { ROUTES, createAppRouter } from './routes'

// Ленивые страницы на холодном старте грузятся дольше секунды.
const LAZY = { timeout: 5000 }

// Витрины здесь нет: она тяжёлая (графики, все секции) и под нагрузкой полного прогона не укладывается в 5 с.
// Её маршрут проверяет свой тест в AppShell.test.tsx, саму витрину — src/ui/showcase/showcase.test.tsx.
const samples = [
  '/',
  '/journal',
  '/record/abc',
  '/record/new/fuel',
  '/items/item.engine_oil',
  '/settings/sync',
]

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
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

describe('маршруты', () => {
  test.each(samples)('%s открывает свой экран', async (path) => {
    const router = renderAt(path)
    // Заголовок экрана (h1) появляется, когда ленивая страница загрузилась.
    expect(await screen.findByRole('heading', { level: 1 }, LAZY)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(path)
    expect(screen.queryByRole('heading', { name: 'Страница не найдена' })).not.toBeInTheDocument()
  })

  test('неизвестный путь показывает «Страница не найдена» с дорогой на главную', async () => {
    const router = renderAt('/nope/42')
    expect(await screen.findByRole('heading', { level: 1, name: 'Страница не найдена' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'На главную' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  test('у каждого маршрута есть заголовок', () => {
    for (const r of ROUTES) expect(r.title.length).toBeGreaterThan(0)
  })
})
