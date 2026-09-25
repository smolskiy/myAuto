import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router'
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '../../app/providers'
import { createAppRouter } from '../../app/routes'
import { db } from '../../db/instance'
import { BUILTIN_CATALOG, CATALOG_ID, STARTER_REMINDER_ITEM_IDS } from '../../domain/catalog'

vi.setConfig({ testTimeout: 20_000 })

const renderAt = (path: string) => {
  const router = createAppRouter({ initialPath: path })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return router
}

beforeAll(async () => {
  await import('./OnboardingPage')
})
beforeEach(async () => {
  await db.open()
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

async function addVehicleStep() {
  await userEvent.type(await screen.findByLabelText('Марка'), 'Skoda')
  await userEvent.type(screen.getByLabelText('Модель'), 'Octavia')
  await userEvent.click(screen.getByRole('button', { name: 'Дальше' }))
  await screen.findByRole('heading', { name: 'Что напоминать' })
}

test('полный проход без Диска: машина, 8 правил из каталога, «Позже» — на главную', async () => {
  const router = renderAt('/onboarding')
  expect(await screen.findByRole('heading', { name: 'Добавьте машину' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Добро пожаловать' })).toBeInTheDocument()
  await addVehicleStep()
  for (const id of STARTER_REMINDER_ITEM_IDS) {
    const name = BUILTIN_CATALOG.find((i) => i.id === id)!.name
    expect(screen.getByRole('checkbox', { name })).toBeChecked()
  }
  await userEvent.click(screen.getByRole('button', { name: 'Дальше' }))
  expect(await screen.findByRole('heading', { name: 'Синхронизация' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Позже' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/'))

  const [vehicle, ...rest] = await db.vehicles.toArray()
  expect(rest).toHaveLength(0)
  expect(vehicle).toMatchObject({ name: 'Skoda Octavia', archived: false })
  const rules = await db.reminderRules.toArray()
  expect(rules).toHaveLength(8)
  expect(rules.map((r) => r.itemId).sort()).toEqual([...STARTER_REMINDER_ITEM_IDS].sort())
  const oil = rules.find((r) => r.itemId === CATALOG_ID.engineOil)!
  expect(oil).toMatchObject({ vehicleId: vehicle!.id, intervalKm: 10000, intervalMonths: 12, enabled: true })
  expect(oil.baseline).toBeUndefined()
})

test('снятый флажок не создаёт правило; пробег «последний раз» уходит в baseline', async () => {
  renderAt('/onboarding')
  await addVehicleStep()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Свечи зажигания' }))
  const oil = screen.getByRole('group', { name: 'Моторное масло' })
  await userEvent.type(within(oil).getByLabelText('Когда делали последний раз'), '140000')
  await userEvent.click(screen.getByRole('button', { name: 'Дальше' }))
  await screen.findByRole('heading', { name: 'Синхронизация' })

  const rules = await db.reminderRules.toArray()
  expect(rules).toHaveLength(7)
  expect(rules.some((r) => r.itemId === CATALOG_ID.sparkPlugs)).toBe(false)
  expect(rules.find((r) => r.itemId === CATALOG_ID.engineOil)!.baseline).toEqual({ odometer: 140000 })
})

test('интервалы узлов подписаны из каталога', async () => {
  renderAt('/onboarding')
  await addVehicleStep()
  const oil = screen.getByRole('group', { name: 'Моторное масло' })
  expect(within(oil).getByText('каждые 10 000 км или 12 мес.')).toBeInTheDocument()
  const brake = screen.getByRole('group', { name: 'Тормозная жидкость' })
  expect(within(brake).getByText('каждые 24 мес.')).toBeInTheDocument()
})

test('«Подключить Яндекс.Диск» без ClientID ведёт в настройки синхронизации', async () => {
  const router = renderAt('/onboarding')
  await addVehicleStep()
  await userEvent.click(screen.getByRole('button', { name: 'Дальше' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Подключить Яндекс.Диск' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/settings/sync'))
})
