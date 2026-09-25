import { render, screen } from '@testing-library/react'
import { RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { db } from '../db/instance'
import { repos } from '../db/repos'
import { AppProviders } from './providers'
import { ROUTES, createAppRouter } from './routes'

// Ленивые страницы (особенно витрина) на холодном старте грузятся дольше секунды.
const LAZY = { timeout: 5000 }

const samples = [
  '/',
  '/journal',
  '/record/abc',
  '/record/new/fuel',
  '/items/item.engine_oil',
  '/settings/sync',
  '/showcase',
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
    // Заголовок экрана (h1) появляется, когда ленивая страница загрузилась (в витрине их несколько — эскизы).
    expect((await screen.findAllByRole('heading', { level: 1 }, LAZY)).length).toBeGreaterThan(0)
    expect(router.state.location.pathname).toBe(path)
    expect(screen.queryByRole('heading', { name: 'Страница не найдена' })).not.toBeInTheDocument()
  })

  test('неизвестный путь показывает «Страница не найдена»', async () => {
    renderAt('/nope/42')
    expect(await screen.findByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument()
  })

  test('у каждого маршрута есть заголовок', () => {
    for (const r of ROUTES) expect(r.title.length).toBeGreaterThan(0)
  })
})
