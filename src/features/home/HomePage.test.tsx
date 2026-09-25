import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { CATALOG_ID } from '../../domain/catalog'
import type { UpcomingItem } from '../../domain/calc/reminders'
import { addDays, todayISO } from '../../domain/dates'
import { NBSP } from '../../domain/format'
import type { ID } from '../../domain/types'
import { ToastProvider } from '../../ui'
import HomePage from './HomePage'
import { reminderCardProps } from './reminderText'

// Статус — один и тот же объект, пока тест его не заменит: useSyncExternalStore сравнивает снимки по ссылке.
const OFF = { state: 'off', pendingUploads: 0 }
const sync = vi.hoisted(() => ({ status: { state: 'off', pendingUploads: 0 } as object }))
vi.mock('../../sync/index', () => ({
  attachmentStore: { getThumbUrl: async () => null, getOriginalUrl: async () => null },
  syncEngine: { subscribe: () => () => {}, getStatus: () => sync.status, syncNow: async () => {} },
  yandexAuth: { subscribe: () => () => {}, isConnected: () => false, getLoginError: () => null },
}))

/** Все пробелы — неразрывные (даты «19 октября 2026» и числа с единицами). */
const nb = (s: string) => s.replaceAll(' ', NBSP)

beforeEach(async () => {
  await db.open()
  sync.status = OFF
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const renderAt = (element: ReactNode) => {
  const router = createMemoryRouter(
    [
      { path: '/', element },
      { path: '*', element: <p>Другой экран</p> },
    ],
    { initialEntries: ['/'] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

const addVehicle = (name: string, model: string, order = 0) =>
  repos.vehicles.create({ name, make: 'Skoda', model, year: 2016, archived: false, fluids: [], order })

const addOilChange = (vehicleId: ID, date: string, odometer: number) =>
  repos.records.create({
    vehicleId,
    kind: 'service',
    date,
    odometer,
    total: 500000,
    title: 'ТО',
    serviceType: 'maintenance',
    diy: false,
    works: [],
    parts: [
      { id: 'p1', itemId: CATALOG_ID.engineOil, name: 'Масло 5W-30', qty: 4, unit: 'l', ownPart: true },
    ],
  })

describe('главная', () => {
  test('«Скоро» показывает напоминание о масле со статусом', async () => {
    const today = todayISO()
    const car = await addVehicle('Октавия', 'Octavia')
    await addOilChange(car.id, addDays(today, -100), 140000)
    await repos.records.create({
      vehicleId: car.id,
      kind: 'odometer',
      date: today,
      odometer: 149200,
      total: 0,
    })
    await repos.reminders.create({
      vehicleId: car.id,
      itemId: CATALOG_ID.engineOil,
      intervalKm: 10000,
      intervalMonths: 12,
      enabled: true,
    })
    renderAt(<HomePage />)
    const soon = await screen.findByRole('region', { name: 'Скоро' })
    expect(await within(soon).findByRole('button', { name: 'Моторное масло' })).toBeInTheDocument()
    expect(within(soon).getByText('Скоро', { selector: 'span' })).toBeInTheDocument()
    // Testing Library сводит неразрывные пробелы страницы к обычным.
    expect(within(soon).getByText('через 800 км', { exact: false })).toBeInTheDocument()
  })

  test('плитка месяца — сумма записей текущего месяца', async () => {
    const today = todayISO()
    const monthStart = `${today.slice(0, 7)}-01`
    const car = await addVehicle('Октавия', 'Octavia')
    await repos.records.create({
      vehicleId: car.id,
      kind: 'expense',
      date: today,
      total: 150000,
      category: 'wash',
    })
    await repos.records.create({
      vehicleId: car.id,
      kind: 'expense',
      date: monthStart,
      total: 250000,
      category: 'parking',
    })
    await repos.records.create({
      vehicleId: car.id,
      kind: 'expense',
      date: addDays(monthStart, -1),
      total: 99900,
      category: 'fine',
    })
    renderAt(<HomePage />)
    const tile = await screen.findByRole('button', { name: /Потрачено в/ })
    await waitFor(() => expect(tile).toHaveTextContent('Потрачено в'))
    await waitFor(() => expect(tile).toHaveTextContent('4 000 ₽'))
  })

  test('пустая машина: нет напоминаний и записей — с действиями', async () => {
    await addVehicle('Октавия', 'Octavia')
    const router = renderAt(<HomePage />)
    expect(await screen.findByText('Напоминаний нет')).toBeInTheDocument()
    expect(await screen.findByText('Записей пока нет')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Потрачено в/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Настроить' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/reminders/new'))
  })

  test('значок синхронизации не выдаёт ждущие фото за неотправленные изменения', async () => {
    sync.status = { state: 'idle', pendingUploads: 3, lastSyncAt: Date.now() - 5 * 60_000 }
    await addVehicle('Октавия', 'Octavia')
    renderAt(<HomePage />)
    const badge = await screen.findByRole('button', { name: 'Синхронизация: всё сохранено' })
    expect(badge).toHaveAttribute('title', `Последняя синхронизация: 5${NBSP}минут назад`)
    expect(badge).not.toHaveTextContent('3')
  })

  test('быстрые кнопки ведут в формы записей', async () => {
    await addVehicle('Октавия', 'Octavia')
    const router = renderAt(<HomePage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Заправка' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/record/new/fuel'))
  })

  test('последние записи — пять строк, новые сверху', async () => {
    const today = todayISO()
    const car = await addVehicle('Октавия', 'Octavia')
    for (let i = 0; i < 7; i++) {
      await repos.records.create({
        vehicleId: car.id,
        kind: 'note',
        date: addDays(today, -i),
        total: 0,
        title: `Заметка ${i}`,
      })
    }
    renderAt(<HomePage />)
    const recent = await screen.findByRole('region', { name: 'Последние записи' })
    await waitFor(() => expect(within(recent).getAllByRole('listitem')).toHaveLength(5))
    expect(within(recent).getAllByRole('listitem')[0]).toHaveTextContent('Заметка 0')
  })

  test('переключение машины меняет карточку', async () => {
    await addVehicle('Октавия', 'Octavia', 0)
    await addVehicle('Рапид', 'Rapid', 1)
    renderAt(<HomePage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Октавия, сменить машину' }))
    const sheet = await screen.findByRole('dialog', { name: 'Машины' })
    await userEvent.click(within(sheet).getByRole('button', { name: /Рапид/ }))
    expect(await screen.findByRole('button', { name: 'Рапид, сменить машину' })).toBeInTheDocument()
  })

  test('Октавия A5: чертёж с выноской о масле ведёт к напоминаниям', async () => {
    const today = todayISO()
    const car = await repos.vehicles.create({
      name: 'Октавия',
      make: 'Skoda',
      model: 'Octavia',
      year: 2011,
      archived: false,
      fluids: [],
      order: 0,
    })
    await addOilChange(car.id, addDays(today, -100), 140000)
    await repos.records.create({
      vehicleId: car.id,
      kind: 'odometer',
      date: today,
      odometer: 149200,
      total: 0,
    })
    await repos.reminders.create({
      vehicleId: car.id,
      itemId: CATALOG_ID.engineOil,
      intervalKm: 10000,
      intervalMonths: 12,
      enabled: true,
    })
    const router = renderAt(<HomePage />)
    const schematic = await screen.findByRole('button', { name: 'Схема машины: скоро — Моторное масло' })
    expect(within(schematic).getByText('Масло')).toBeInTheDocument()
    expect(within(schematic).getByText('через 800 км')).toBeInTheDocument()
    expect(within(schematic).getByText('Скоро 1')).toBeInTheDocument()
    await userEvent.click(schematic)
    expect(router.state.location.pathname).toBe('/reminders')
  })

  test('машина без чертежа — карточка без схемы', async () => {
    await addVehicle('Октавия', 'Octavia')
    renderAt(<HomePage />)
    await screen.findByRole('button', { name: 'Октавия, сменить машину' })
    expect(screen.queryByRole('button', { name: /Схема машины/ })).not.toBeInTheDocument()
  })
})

describe('reminderCardProps', () => {
  const TODAY = '2026-09-25'
  const base = (over: Partial<UpcomingItem>): UpcomingItem => ({
    key: 'reminder:r1',
    type: 'reminder',
    title: 'Моторное масло',
    state: 'ok',
    ...over,
  })

  test('остатки, прогноз и последняя замена', () => {
    const props = reminderCardProps(
      base({
        remainingKm: 1200,
        remainingDays: 112,
        predictedDate: '2026-10-19',
        reminder: {
          ruleId: 'r1',
          vehicleId: 'v1',
          title: 'Моторное масло',
          state: 'ok',
          last: { date: '2026-01-15', odometer: 140000, source: 'record' },
          progressKm: 0.88,
          progressTime: 0.7,
        },
      }),
      TODAY,
    )
    expect(props).toMatchObject({
      title: 'Моторное масло',
      state: 'ok',
      kmText: `через ${nb('1 200 км')}`,
      timeText: `через 112${NBSP}дней`,
      predicted: nb('≈ 19 октября'),
      lastText: `последняя: 15.01.2026, ${nb('140 000 км')}`,
      progressKm: 0.88,
      progressTime: 0.7,
    })
  })

  test('просрочено и сегодня', () => {
    expect(reminderCardProps(base({ remainingKm: -300, remainingDays: -3 }), TODAY)).toMatchObject({
      kmText: `просрочено на 300${NBSP}км`,
      timeText: `просрочено на 3${NBSP}дня`,
    })
    expect(reminderCardProps(base({ remainingDays: 0 }), TODAY).timeText).toBe('сегодня')
  })

  test('прогноз на другой год — с годом', () => {
    expect(reminderCardProps(base({ predictedDate: '2027-01-10' }), TODAY).predicted).toBe(
      nb('≈ 10 января 2027'),
    )
  })

  test('прошедшая дата не выдаётся за прогноз', () => {
    const props = reminderCardProps(
      base({ state: 'overdue', remainingDays: -30, predictedDate: '2026-08-26' }),
      TODAY,
    )
    expect(props.predicted).toBeUndefined()
    expect(reminderCardProps(base({ predictedDate: TODAY }), TODAY).predicted).toBe(nb('≈ 25 сентября'))
  })

  test('нет данных — без текстов', () => {
    const props = reminderCardProps(base({ state: 'unknown' }), TODAY)
    expect(props.kmText).toBeUndefined()
    expect(props.timeText).toBeUndefined()
    expect(props.predicted).toBeUndefined()
    expect(props.lastText).toBeUndefined()
  })

  test('срок документа — дата окончания', () => {
    const props = reminderCardProps(
      {
        key: 'deadline:osago:v1',
        type: 'deadline',
        title: 'ОСАГО',
        state: 'soon',
        remainingDays: 17,
        deadline: {
          key: 'deadline:osago:v1',
          vehicleId: 'v1',
          kind: 'osago',
          title: 'ОСАГО',
          validUntil: '2026-10-12',
          remainingDays: 17,
          state: 'soon',
          source: { type: 'document', id: 'd1' },
        },
      },
      TODAY,
    )
    expect(props.timeText).toBe(`через 17${NBSP}дней`)
    expect(props.lastText).toBe('действует до 12.10.2026')
  })
})
