import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { addDays, todayISO } from '../../domain/dates'
import { formatDate } from '../../domain/format'
import { ThemeProvider, ToastProvider } from '../../ui'
import { periodRange } from './periods'
import { niceTicks } from './StatsCharts'
import StatsPage from './StatsPage'

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

const renderStats = () => {
  const router = createMemoryRouter(
    [
      { path: '/stats', element: <StatsPage /> },
      { path: '*', element: <p>Другой экран</p> },
    ],
    { initialEntries: ['/stats'] },
  )
  render(
    <ThemeProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ThemeProvider>,
  )
  return router
}

const addVehicle = () =>
  repos.vehicles.create({
    name: 'Октавия',
    make: 'Skoda',
    model: 'Octavia',
    archived: false,
    fluids: [],
    order: 0,
  })

/** За последние 12 месяцев: топливо 3 000 ₽, ТО (запчасти 5 000 + работы 2 000), мойка 500 — 10 500 ₽ на 1 000 км. */
async function seed() {
  const today = todayISO()
  const car = await addVehicle()
  await repos.records.create({
    vehicleId: car.id,
    kind: 'fuel',
    date: addDays(today, -60),
    odometer: 10000,
    total: 300000,
    liters: 60,
    pricePerLiter: 5000,
    fullTank: true,
    missedBefore: false,
  })
  await repos.records.create({
    vehicleId: car.id,
    kind: 'service',
    date: addDays(today, -10),
    odometer: 11000,
    total: 700000,
    title: 'ТО',
    serviceType: 'maintenance',
    diy: false,
    works: [{ id: 'w1', name: 'Замена масла', price: 200000 }],
    parts: [{ id: 'p1', name: 'Масло', qty: 1, unit: 'pcs', unitPrice: 500000, ownPart: true }],
  })
  await repos.records.create({
    vehicleId: car.id,
    kind: 'expense',
    date: today,
    total: 50000,
    category: 'wash',
  })
  await repos.records.create({
    vehicleId: car.id,
    kind: 'expense',
    date: addDays(today, -800),
    total: 100000,
    category: 'tax',
  })
  return car
}

describe('periodRange', () => {
  const TODAY = '2026-09-25'
  test('месяц, год, 12 месяцев, всё время', () => {
    expect(periodRange('month', TODAY)).toEqual({ from: '2026-09-01', to: TODAY })
    expect(periodRange('year', TODAY)).toEqual({ from: '2026-01-01', to: TODAY })
    expect(periodRange('12m', TODAY)).toEqual({ from: '2025-09-26', to: TODAY })
    expect(periodRange('all', TODAY)).toEqual({})
  })
  test('12 месяцев от 29 февраля', () => {
    expect(periodRange('12m', '2028-02-29')).toEqual({ from: '2027-03-01', to: '2028-02-29' })
  })
})

test('деления оси — круглые числа от нуля', () => {
  expect(niceTicks(17800)).toEqual([0, 5000, 10000, 15000, 20000])
  expect(niceTicks(9000)).toEqual([0, 2500, 5000, 7500, 10000])
  expect(niceTicks(800)).toEqual([0, 200, 400, 600, 800])
  expect(niceTicks(0)).toEqual([0])
})

describe('статистика', () => {
  test('плитки за 12 месяцев: всего, цена километра, пробег', async () => {
    await seed()
    renderStats()
    const total = await screen.findByText('Всего')
    await waitFor(() => expect(total.parentElement).toHaveTextContent('10 500 ₽'))
    expect(screen.getByText('Цена километра').parentElement).toHaveTextContent('10,5 ₽/км')
    expect(screen.getByText('Пробег за период').parentElement).toHaveTextContent('1 000 км')
  })

  test('таблица групп — по убыванию', async () => {
    await seed()
    renderStats()
    const card = await screen.findByRole('region', { name: 'На что уходят деньги' })
    const table = within(card).getByRole('table')
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(5))
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((r) => r.querySelector('th')?.textContent)).toEqual([
      'Запчасти',
      'Топливо',
      'Работы',
      'Мойка',
    ])
    expect(rows[0]).toHaveTextContent('5 000')
  })

  test('период «Всё время» включает старые записи', async () => {
    await seed()
    renderStats()
    await userEvent.click(await screen.findByRole('radio', { name: 'Всё время' }))
    await waitFor(() => expect(screen.getByText('Всего').parentElement).toHaveTextContent('11 500 ₽'))
  })

  test('цвета графика перечитываются, когда на странице сменилась тема', async () => {
    await seed()
    const root = document.documentElement
    root.dataset.theme = 'light'
    renderStats()
    const legend = await screen.findByText('Топливо', { selector: 'li' })
    const swatch = legend.querySelector('span')!
    expect(swatch).toHaveStyle({ background: '#0B7F72' })
    // Тёмная тема: токен меняется вместе с data-theme (в jsdom стилей нет — ставим переменную вручную).
    root.style.setProperty('--kind-fuel', '#3ccbb6')
    root.dataset.theme = 'dark'
    await waitFor(() => expect(swatch).toHaveStyle({ background: '#3ccbb6' }))
    root.style.removeProperty('--kind-fuel')
    delete root.dataset.theme
  })

  test('длинная таблица заправок свёрнута до последних, «Все заправки» раскрывает', async () => {
    const today = todayISO()
    const car = await addVehicle()
    for (let i = 0; i <= 10; i++) {
      await repos.records.create({
        vehicleId: car.id,
        kind: 'fuel',
        date: addDays(today, -200 + i * 15),
        odometer: 10000 + i * 500,
        total: 200000,
        liters: 40,
        pricePerLiter: 5000,
        fullTank: true,
        missedBefore: false,
      })
    }
    renderStats()
    const card = await screen.findByRole('region', { name: 'Расход топлива' })
    const table = within(card).getByRole('table')
    // Новые сверху: первая строка — последняя заправка.
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 6)
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent(formatDate(addDays(today, -50)))
    await userEvent.click(within(card).getByRole('button', { name: 'Все заправки (10)' }))
    expect(within(table).getAllByRole('row')).toHaveLength(1 + 10)
  })

  test('маленькая доля — «<1 %», а не ноль', async () => {
    const today = todayISO()
    const car = await addVehicle()
    await repos.records.create({
      vehicleId: car.id,
      kind: 'expense',
      date: today,
      total: 10000000,
      category: 'kasko',
    })
    await repos.records.create({
      vehicleId: car.id,
      kind: 'expense',
      date: today,
      total: 10000,
      category: 'parking',
    })
    renderStats()
    const card = await screen.findByRole('region', { name: 'На что уходят деньги' })
    const row = await within(card).findByRole('row', { name: /Парковка/ })
    expect(row).toHaveTextContent('<1 %')
  })

  test('без записей — пустое состояние', async () => {
    await addVehicle()
    renderStats()
    expect(await screen.findByText('Добавьте первые записи — здесь появится статистика')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })
})
