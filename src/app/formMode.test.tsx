import { act, render, screen, waitFor } from '@testing-library/react'
import { RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../db/instance'
import { repos } from '../db/repos'
import { FORM_FOOTER_OFFSET } from '../features/common/formMode'
import { AppProviders } from './providers'
import { createAppRouter } from './routes'

// Экран документа — форма (как сделает волна 2b): маршрут /documents/:id сам по себе панель не прячет.
vi.mock('../features/documents/DocumentPage', async () => {
  const { FormPage } = await import('../features/common')
  return {
    default: () => (
      <FormPage title="Документ" onSave={async () => {}}>
        <p>Поля документа</p>
      </FormPage>
    ),
  }
})

const LAZY = { timeout: 5000 }
const offset = () => document.documentElement.style.getPropertyValue('--toast-offset')

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
  document.documentElement.style.removeProperty('--toast-offset')
})

test('FormPage на маршруте с панелью прячет панель, уведомления — над «Сохранить»', async () => {
  const router = renderAt('/documents/d1')
  await screen.findByRole('button', { name: 'Сохранить' }, LAZY)
  expect(screen.queryByRole('navigation', { name: 'Основная навигация' })).not.toBeInTheDocument()
  expect(offset()).toBe(FORM_FOOTER_OFFSET)

  // Ушли с формы на список — панель вернулась, отступ уведомлений — обычный (над панелью).
  await act(() => router.navigate('/documents'))
  expect(await screen.findByRole('navigation', { name: 'Основная навигация' })).toBeInTheDocument()
  await waitFor(() => expect(offset()).toBe(''))
})

test('форма на маршруте без панели — отступ по кнопке формы, а не 0', async () => {
  renderAt('/documents/new')
  await screen.findByRole('button', { name: 'Сохранить' }, LAZY)
  expect(offset()).toBe(FORM_FOOTER_OFFSET)
})

test('FormPage не трогает body — отступом управляет только оболочка', async () => {
  renderAt('/documents/d1')
  await screen.findByRole('button', { name: 'Сохранить' }, LAZY)
  expect(document.body.style.getPropertyValue('--toast-offset')).toBe('')
})
