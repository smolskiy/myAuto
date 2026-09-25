import { render, screen } from '@testing-library/react'
import { RouterProvider } from 'react-router'
import { describe, expect, test } from 'vitest'
import { ROUTES, createAppRouter } from './routes'

const samples: Record<string, string> = {
  '/': 'Главная',
  '/journal': 'Журнал',
  '/record/abc': 'Запись',
  '/record/new/fuel': 'Запись',
  '/items/item.engine_oil': 'История узла',
  '/settings/sync': 'Синхронизация',
  '/showcase': 'Витрина компонентов',
}

describe('маршруты', () => {
  test.each(Object.entries(samples))('%s открывает «%s»', async (path, title) => {
    render(<RouterProvider router={createAppRouter({ initialPath: path })} />)
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument()
  })

  test('неизвестный путь показывает «Страница не найдена»', async () => {
    render(<RouterProvider router={createAppRouter({ initialPath: '/nope/42' })} />)
    expect(await screen.findByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument()
  })

  test('у каждого маршрута есть заголовок', () => {
    for (const r of ROUTES) expect(r.title.length).toBeGreaterThan(0)
  })
})
