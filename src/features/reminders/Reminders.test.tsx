import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
import { remindersToIcs } from './calendar'
import ReminderRulePage from './ReminderRulePage'
import RemindersPage from './RemindersPage'

const OFF = { state: 'off', pendingUploads: 0 }
vi.mock('../../sync/index', () => ({
  attachmentStore: { getThumbUrl: async () => null, getOriginalUrl: async () => null },
  syncEngine: { subscribe: () => () => {}, getStatus: () => OFF, syncNow: async () => {} },
  yandexAuth: { subscribe: () => () => {}, isConnected: () => false, getLoginError: () => null },
}))
const files = vi.hoisted(() => ({ saveFile: vi.fn(async (_blob: Blob, _name: string) => {}) }))
vi.mock('../../sync/saveFile', () => ({
  saveFile: files.saveFile,
  backupFileName: (kind: string, today: string) => `moy-avto-${today}.${kind}`,
}))

beforeEach(async () => {
  await db.open()
  files.saveFile.mockClear()
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

const renderAt = (path: string) => {
  const router = createMemoryRouter(
    [
      { path: '/reminders', element: <RemindersPage /> },
      { path: '/reminders/new', element: <ReminderRulePage /> },
      { path: '/reminders/:id', element: <ReminderRulePage /> },
      { path: '*', element: <p>Другой экран</p> },
    ],
    { initialEntries: path === '/reminders' ? [path] : ['/reminders', path] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
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

const addService = (vehicleId: ID, date: string, odometer: number, itemId: ID) =>
  repos.records.create({
    vehicleId,
    kind: 'service',
    date,
    odometer,
    total: 300000,
    title: 'ТО',
    serviceType: 'maintenance',
    diy: false,
    works: [],
    parts: [{ id: `p-${itemId}`, itemId, name: 'Деталь', qty: 1, unit: 'pcs', ownPart: true }],
  })

/** Машина с напоминаниями во всех состояниях: масло просрочено, ОСАГО скоро, фильтр в порядке, свечи — нет данных. */
async function seedAllStates() {
  const today = todayISO()
  const car = await addVehicle()
  await addService(car.id, addDays(today, -400), 100000, CATALOG_ID.engineOil)
  await addService(car.id, addDays(today, -30), 105000, CATALOG_ID.airFilter)
  const rule = (itemId: ID, intervalKm: number, intervalMonths: number) =>
    repos.reminders.create({ vehicleId: car.id, itemId, intervalKm, intervalMonths, enabled: true })
  await rule(CATALOG_ID.engineOil, 10000, 12)
  await rule(CATALOG_ID.airFilter, 20000, 24)
  const plugs = await rule(CATALOG_ID.sparkPlugs, 30000, 36)
  const osago = await repos.documents.create({
    vehicleId: car.id,
    kind: 'osago',
    validUntil: addDays(today, 10),
  })
  return { car, plugs, osago }
}

describe('список ТО и напоминаний', () => {
  test('группы по статусам', async () => {
    await seedAllStates()
    renderAt('/reminders')
    const overdue = await screen.findByRole('list', { name: 'Просрочено' })
    expect(within(overdue).getByRole('button', { name: 'Моторное масло' })).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: 'Скоро' })).getByRole('button', { name: 'ОСАГО' }),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: 'В порядке' })).getByRole('button', {
        name: 'Воздушный фильтр',
      }),
    ).toBeInTheDocument()
    const unknown = screen.getByRole('list', { name: 'Нет данных' })
    expect(within(unknown).getByRole('button', { name: 'Свечи зажигания' })).toBeInTheDocument()
  })

  test('«Нет данных» предлагает указать, когда делали', async () => {
    const { plugs } = await seedAllStates()
    const router = renderAt('/reminders')
    const unknown = await screen.findByRole('list', { name: 'Нет данных' })
    await userEvent.click(within(unknown).getByRole('button', { name: 'Указать, когда делали' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/reminders/${plugs.id}`))
  })

  test('срок документа ведёт в документ', async () => {
    const { osago } = await seedAllStates()
    const router = renderAt('/reminders')
    await userEvent.click(await screen.findByRole('button', { name: 'ОСАГО' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/documents/${osago.id}`))
  })

  test('«В календарь» сохраняет .ics с датами', async () => {
    await seedAllStates()
    renderAt('/reminders')
    await screen.findByRole('list', { name: 'Просрочено' })
    await userEvent.click(screen.getByRole('button', { name: 'В календарь' }))
    await waitFor(() => expect(files.saveFile).toHaveBeenCalledTimes(1))
    const [blob, name] = files.saveFile.mock.calls[0]!
    expect(name).toBe('moy-avto-napominaniya.ics')
    expect(blob.type).toBe('text/calendar;charset=utf-8')
    const text = await blob.text()
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(3)
    expect(text).toContain('SUMMARY:Октавия: ОСАГО')
  })

  test('нечего выгружать в календарь — сообщение', async () => {
    const car = await addVehicle()
    await repos.reminders.create({
      vehicleId: car.id,
      itemId: CATALOG_ID.sparkPlugs,
      intervalKm: 30000,
      enabled: true,
    })
    renderAt('/reminders')
    await screen.findByRole('list', { name: 'Нет данных' })
    await userEvent.click(screen.getByRole('button', { name: 'В календарь' }))
    expect(await screen.findByText('Нет дат для календаря')).toBeInTheDocument()
    expect(files.saveFile).not.toHaveBeenCalled()
  })

  test('без напоминаний — пустое состояние с действием', async () => {
    await addVehicle()
    const router = renderAt('/reminders')
    expect(await screen.findByText('Напоминаний пока нет')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Добавить напоминание' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/reminders/new'))
  })

  test('выключенное напоминание видно отдельно', async () => {
    const car = await addVehicle()
    await repos.reminders.create({
      vehicleId: car.id,
      itemId: CATALOG_ID.cabinFilter,
      intervalKm: 15000,
      enabled: false,
    })
    renderAt('/reminders')
    const off = await screen.findByRole('list', { name: 'Выключены' })
    expect(within(off).getByText('Салонный фильтр')).toBeInTheDocument()
  })
})

describe('remindersToIcs', () => {
  const NOW = new Date('2026-09-25T10:00:00Z')
  const item = (over: Partial<UpcomingItem>): UpcomingItem => ({
    key: 'reminder:r1',
    type: 'reminder',
    title: 'Моторное масло',
    state: 'ok',
    ...over,
  })

  test('два срока — два события с названием машины', () => {
    const ics = remindersToIcs(
      [
        item({ predictedDate: '2026-10-19', remainingKm: 1200 }),
        item({
          key: 'deadline:osago:v1',
          type: 'deadline',
          title: 'ОСАГО',
          deadline: {
            key: 'deadline:osago:v1',
            vehicleId: 'v1',
            kind: 'osago',
            title: 'ОСАГО',
            validUntil: '2026-11-01',
            remainingDays: 37,
            state: 'ok',
            source: { type: 'document', id: 'd1' },
          },
        }),
        item({ key: 'reminder:r3', title: 'Свечи', state: 'unknown' }),
      ],
      'Октавия',
      NOW,
    )
    expect(ics).not.toBeNull()
    expect(ics!.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics).toContain('SUMMARY:Октавия: Моторное масло')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261019')
    expect(ics).toContain('DESCRIPTION:Прогноз по пробегу')
    expect(ics).toContain('SUMMARY:Октавия: ОСАГО')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261101')
    expect(ics).toContain('DESCRIPTION:Срок действия')
  })

  test('без дат — null', () => {
    expect(remindersToIcs([item({ state: 'unknown' })], 'Октавия', NOW)).toBeNull()
    expect(remindersToIcs([], 'Октавия', NOW)).toBeNull()
  })

  test('просроченное — событие на сегодня, а не в прошлом', () => {
    const ics = remindersToIcs(
      [
        item({ state: 'overdue', predictedDate: '2026-08-26', remainingDays: -30 }),
        item({
          key: 'deadline:osago:v1',
          type: 'deadline',
          title: 'ОСАГО',
          state: 'overdue',
          deadline: {
            key: 'deadline:osago:v1',
            vehicleId: 'v1',
            kind: 'osago',
            title: 'ОСАГО',
            validUntil: '2026-09-01',
            remainingDays: -24,
            state: 'overdue',
            source: { type: 'document', id: 'd1' },
          },
        }),
      ],
      'Октавия',
      NOW,
    )!
    expect(ics.match(/DTSTART;VALUE=DATE:20260925/g)).toHaveLength(2)
    expect(ics).not.toContain('DTSTART;VALUE=DATE:20260826')
    expect(ics).not.toContain('DTSTART;VALUE=DATE:20260901')
  })
})

describe('форма напоминания', () => {
  test('узел из каталога заполняет интервалы, правило сохраняется', async () => {
    const car = await addVehicle()
    const router = renderAt('/reminders/new')
    await userEvent.type(await screen.findByRole('combobox', { name: 'Узел' }), 'моторное')
    await userEvent.click(await screen.findByRole('option', { name: /Моторное масло/ }))
    expect(screen.getByRole('textbox', { name: 'Каждые … км' })).toHaveValue(`10${NBSP}000`)
    expect(screen.getByRole('textbox', { name: 'Каждые … мес.' })).toHaveValue('12')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/reminders'))
    const rules = await repos.reminders.list()
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({
      vehicleId: car.id,
      itemId: CATALOG_ID.engineOil,
      intervalKm: 10000,
      intervalMonths: 12,
      enabled: true,
    })
  })

  test('без интервалов — «Укажите интервал»', async () => {
    await addVehicle()
    renderAt('/reminders/new')
    await userEvent.type(await screen.findByRole('textbox', { name: 'Своё название' }), 'Антифриз')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    // Ошибка — у поля интервала; уведомления нет, форма остаётся.
    const km = screen.getByRole('textbox', { name: 'Каждые … км' })
    await waitFor(() => expect(km).toHaveAccessibleDescription(/Укажите интервал/))
    expect(screen.getAllByText('Укажите интервал')).toHaveLength(1)
    expect(screen.queryByRole('status')).not.toHaveTextContent(/сохранить/i)
    expect(await repos.reminders.list()).toHaveLength(0)
  })

  test('узел без интервалов в каталоге не стирает введённые интервалы', async () => {
    await addVehicle()
    renderAt('/reminders/new')
    const km = await screen.findByRole('textbox', { name: 'Каждые … км' })
    const months = screen.getByRole('textbox', { name: 'Каждые … мес.' })
    await userEvent.type(km, '15000')
    await userEvent.type(months, '6')
    // «Сцепление» — без интервалов по умолчанию.
    await userEvent.type(screen.getByRole('combobox', { name: 'Узел' }), 'сцепл')
    await userEvent.click(await screen.findByRole('option', { name: /Сцепление/ }))
    expect(km).toHaveValue(`15${NBSP}000`)
    expect(months).toHaveValue('6')
  })

  test('смена узла заменяет интервалы, подставленные прошлым узлом', async () => {
    await addVehicle()
    renderAt('/reminders/new')
    const picker = await screen.findByRole('combobox', { name: 'Узел' })
    await userEvent.type(picker, 'моторное')
    await userEvent.click(await screen.findByRole('option', { name: /Моторное масло/ }))
    const km = screen.getByRole('textbox', { name: 'Каждые … км' })
    expect(km).toHaveValue(`10${NBSP}000`)
    await userEvent.click(screen.getByRole('button', { name: 'Очистить' }))
    await userEvent.type(picker, 'сцепл')
    await userEvent.click(await screen.findByRole('option', { name: /Сцепление/ }))
    expect(km).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Каждые … мес.' })).toHaveValue('')
  })

  test('«К дате» сохраняет правило без узла', async () => {
    const car = await addVehicle()
    renderAt('/reminders/new?item=item.engine_oil')
    await userEvent.click(await screen.findByRole('radio', { name: 'К дате' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Название' }), 'Техосмотр')
    fireEvent.change(screen.getByLabelText('Дата'), { target: { value: '2026-12-01' } })
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => expect(await repos.reminders.list()).toHaveLength(1))
    const [rule] = await repos.reminders.list()
    expect(rule).toMatchObject({
      vehicleId: car.id,
      title: 'Техосмотр',
      dueDate: '2026-12-01',
      enabled: true,
    })
    expect(rule!.itemId).toBeUndefined()
    expect(rule!.intervalKm).toBeUndefined()
    expect(rule!.intervalMonths).toBeUndefined()
  })

  test('узел из ссылки истории — предзаполнен', async () => {
    await addVehicle()
    renderAt(`/reminders/new?item=${CATALOG_ID.airFilter}`)
    const picker = await screen.findByRole('combobox', { name: 'Узел' })
    // Имя узла появляется, когда загрузится каталог.
    await waitFor(() => expect(picker).toHaveValue('Воздушный фильтр'))
    expect(screen.getByRole('textbox', { name: 'Каждые … км' })).toHaveValue(`20${NBSP}000`)
  })

  test('правка: выключить и указать, когда делали', async () => {
    const car = await addVehicle()
    const rule = await repos.reminders.create({
      vehicleId: car.id,
      itemId: CATALOG_ID.sparkPlugs,
      intervalKm: 30000,
      intervalMonths: 36,
      enabled: true,
    })
    renderAt(`/reminders/${rule.id}`)
    await screen.findByRole('combobox', { name: 'Узел' })
    expect(screen.getByText('если в журнале нет записи')).toBeInTheDocument()
    const last = screen.getByRole('group', { name: 'Последний раз' })
    fireEvent.change(within(last).getByLabelText('Дата'), { target: { value: '2025-05-10' } })
    await userEvent.type(within(last).getByRole('textbox', { name: 'Пробег' }), '120000')
    await userEvent.click(screen.getByRole('switch', { name: 'Включено' }))
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => expect((await repos.reminders.get(rule.id))?.enabled).toBe(false))
    expect(await repos.reminders.get(rule.id)).toMatchObject({
      baseline: { date: '2025-05-10', odometer: 120000 },
    })
  })

  test('«История узла» ведёт в историю выбранного узла', async () => {
    const car = await addVehicle()
    const rule = await repos.reminders.create({
      vehicleId: car.id,
      itemId: CATALOG_ID.sparkPlugs,
      intervalKm: 30000,
      enabled: true,
    })
    const router = renderAt(`/reminders/${rule.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'История узла' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/items/${CATALOG_ID.sparkPlugs}`))
  })

  test('«Удалить» — мягко, с уведомлением', async () => {
    const car = await addVehicle()
    const rule = await repos.reminders.create({
      vehicleId: car.id,
      itemId: CATALOG_ID.sparkPlugs,
      intervalKm: 30000,
      enabled: true,
    })
    const router = renderAt(`/reminders/${rule.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/reminders'))
    expect(await repos.reminders.get(rule.id)).toBeUndefined()
    expect(await screen.findByText('Напоминание удалено')).toBeInTheDocument()
  })
})
