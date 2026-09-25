import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { CATALOG_ID } from '../../domain/catalog'
import type { ID, PartLine, WorkLine } from '../../domain/types'
import { ToastProvider } from '../../ui'
import ItemHistoryPage from './ItemHistoryPage'

const OFF = { state: 'off', pendingUploads: 0 }
vi.mock('../../sync/index', () => ({
  attachmentStore: { getThumbUrl: async () => null, getOriginalUrl: async () => null },
  syncEngine: { subscribe: () => () => {}, getStatus: () => OFF, syncNow: async () => {} },
  yandexAuth: { subscribe: () => () => {}, isConnected: () => false, getLoginError: () => null },
}))

beforeEach(async () => {
  await db.open()
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const FILTER = CATALOG_ID.oilFilter

const renderAt = (itemId: ID) => {
  const router = createMemoryRouter(
    [
      { path: '/items/:itemId', element: <ItemHistoryPage /> },
      { path: '*', element: <p>Другой экран</p> },
    ],
    { initialEntries: [`/items/${itemId}`] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

const part = (brand: string, partNumber: string, unitPrice: number): PartLine => ({
  id: `p-${partNumber}`,
  itemId: FILTER,
  name: 'Фильтр масляный',
  brand,
  partNumber,
  qty: 1,
  unit: 'pcs',
  unitPrice,
  ownPart: true,
})

async function seed() {
  const car = await repos.vehicles.create({
    name: 'Октавия',
    make: 'Skoda',
    model: 'Octavia',
    archived: false,
    fluids: [],
    order: 0,
  })
  const place = await repos.places.create({ kind: 'service', name: 'Автосервис на Ленина' })
  const service = (date: string, odometer: number, parts: PartLine[], works: WorkLine[] = []) =>
    repos.records.create({
      vehicleId: car.id,
      kind: 'service',
      date,
      odometer,
      total: 200000,
      title: 'ТО',
      serviceType: 'maintenance',
      diy: false,
      placeId: place.id,
      works,
      parts,
    })
  await service('2024-02-10', 120000, [part('Mann-Filter', 'W 712/95', 65000)])
  await service('2025-01-15', 130000, [part('Mann-Filter', 'W 712/95', 70000)])
  const last = await service(
    '2025-11-12',
    139600,
    [part('Bosch', '0 451 103 336', 80000)],
    [{ id: 'w1', itemId: FILTER, name: 'Замена фильтра', price: 50000 }],
  )
  return { car, last }
}

test('сводка: число замен, средний интервал, частый бренд', async () => {
  await seed()
  renderAt(FILTER)
  expect(await screen.findByRole('heading', { level: 1, name: 'Масляный фильтр' })).toBeInTheDocument()
  expect(await screen.findByText('Замен: 3')).toBeInTheDocument()
  expect(screen.getByText('В среднем каждые 9 800 км / 11 мес.')).toBeInTheDocument()
  expect(screen.getByText('Чаще всего: Mann-Filter')).toBeInTheDocument()
})

test('строки: бренд, артикул, цена, место, интервал; ведут в запись', async () => {
  const { last } = await seed()
  const router = renderAt(FILTER)
  const list = await screen.findByRole('list', { name: 'Замены' })
  const rows = within(list).getAllByRole('button')
  expect(rows).toHaveLength(3)
  expect(rows[0]).toHaveTextContent('Bosch · 0 451 103 336')
  expect(rows[0]).toHaveTextContent('1 300 ₽')
  expect(rows[0]).toHaveTextContent('12.11.2025 · 139 600 км · Автосервис на Ленина')
  expect(rows[0]).toHaveTextContent('через 9 600 км · 301 день после прошлой')
  expect(rows[2]).not.toHaveTextContent('после прошлой')
  await userEvent.click(rows[0]!)
  await waitFor(() => expect(router.state.location.pathname).toBe(`/record/${last.id}`))
})

test('нет правила — «Напоминать о замене»', async () => {
  await seed()
  const router = renderAt(FILTER)
  await userEvent.click(await screen.findByRole('button', { name: 'Напоминать о замене' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/reminders/new'))
  expect(router.state.location.search).toBe(`?item=${FILTER}`)
})

test('правило есть — ссылка на него вместо «Напоминать о замене»', async () => {
  const { car } = await seed()
  const rule = await repos.reminders.create({
    vehicleId: car.id,
    itemId: FILTER,
    intervalKm: 10000,
    enabled: true,
  })
  const router = renderAt(FILTER)
  await userEvent.click(await screen.findByRole('button', { name: /Напоминание/ }))
  await waitFor(() => expect(router.state.location.pathname).toBe(`/reminders/${rule.id}`))
  expect(screen.queryByRole('button', { name: 'Напоминать о замене' })).not.toBeInTheDocument()
})

test('замен не было — пустое состояние', async () => {
  await repos.vehicles.create({
    name: 'Октавия',
    make: 'Skoda',
    model: 'Octavia',
    archived: false,
    fluids: [],
    order: 0,
  })
  renderAt(CATALOG_ID.sparkPlugs)
  expect(await screen.findByText('Замен пока не было')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Свечи зажигания' })).toBeInTheDocument()
})
