import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { getMeta, META_KEYS, setMeta } from '../../db/meta'
import { repos } from '../../db/repos'
import type { Vehicle } from '../../domain/types'
import { ToastProvider } from '../../ui'
import VehiclePage from '../vehicle/VehiclePage'
import GaragePage from './GaragePage'

vi.mock('../../sync/index', () => ({
  attachmentStore: {
    getThumbUrl: async (att: { id: string }) => `blob:thumb-${att.id}`,
    getOriginalUrl: async (att: { id: string }) => `blob:orig-${att.id}`,
  },
  syncEngine: { subscribe: () => () => {}, getStatus: () => ({ state: 'off', pendingUploads: 0 }) },
  yandexAuth: { subscribe: () => () => {}, isConnected: () => false, getLoginError: () => null },
}))

const NBSP = '\u00a0'
const revoke = URL.revokeObjectURL

beforeEach(async () => {
  await db.open()
  URL.revokeObjectURL = () => {}
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  URL.revokeObjectURL = revoke
})

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/garage', element: <GaragePage /> },
      { path: '/vehicle/new', element: <p>Форма новой машины</p> },
      { path: '/vehicle/:id/edit', element: <p>Форма правки машины</p> },
      { path: '/vehicle/:id', element: <VehiclePage /> },
      { path: '*', element: <p>Другой экран</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

let order = 0
const addVehicle = (patch: Partial<Vehicle> = {}) =>
  repos.vehicles.create({
    name: 'Октавия',
    make: 'Skoda',
    model: 'Octavia',
    year: 2016,
    plate: 'А123ВС 77',
    archived: false,
    fluids: [],
    order: order++,
    ...patch,
  })

const addFuel = (vehicleId: string, date: string, odometer: number, total: number) =>
  repos.records.create({
    vehicleId,
    kind: 'fuel',
    date,
    odometer,
    total,
    liters: 40,
    pricePerLiter: Math.round(total / 40),
    fullTank: true,
    missedBefore: false,
  })

const activeId = () => getMeta<string | null>(db, META_KEYS.activeVehicleId, null)

describe('гараж', () => {
  test('машины и архив — отдельными списками, активная помечена', async () => {
    const octavia = await addVehicle()
    await addVehicle({ name: 'Рапид', model: 'Rapid', year: 2019, plate: 'В456ОР 50' })
    await addVehicle({ name: 'Старая Лада', make: 'Lada', model: 'Granta', plate: undefined, archived: true })
    await addFuel(octavia.id, '2026-09-01', 148320, 250000)
    renderAt('/garage')

    const mine = await screen.findByRole('list', { name: 'Мои машины' })
    const archive = screen.getByRole('list', { name: 'Архив' })
    await waitFor(() => expect(within(mine).getAllByRole('button')).toHaveLength(2))
    expect(within(archive).getAllByRole('button')).toHaveLength(1)
    expect(within(archive).getByText('Старая Лада')).toBeInTheDocument()

    const first = within(mine).getAllByRole('button')[0]!
    expect(first).toHaveTextContent('Октавия')
    expect(first).toHaveTextContent('Активная')
    expect(first).toHaveTextContent(`Skoda Octavia 2016 · А123ВС 77`)
    await waitFor(() => expect(first.textContent).toContain(`148${NBSP}320${NBSP}км`))
    expect(within(mine).getAllByRole('button')[1]).not.toHaveTextContent('Активная')
  })

  test('строка машины открывает её карточку, «Добавить машину» — форму', async () => {
    const v = await addVehicle()
    const router = renderAt('/garage')
    await userEvent.click(await screen.findByRole('button', { name: /Октавия/ }))
    expect(router.state.location.pathname).toBe(`/vehicle/${v.id}`)

    await router.navigate('/garage')
    await userEvent.click(await screen.findByRole('button', { name: 'Добавить машину' }))
    expect(router.state.location.pathname).toBe('/vehicle/new')
  })
})

describe('карточка машины', () => {
  test('характеристики: VIN, двигатель, КПП, привод, бак, топливо, шины', async () => {
    const v = await addVehicle({
      generation: 'A7',
      vin: 'TMBJJ7NE8G0123456',
      engine: { code: 'CZDA', displacementCc: 1395, powerHp: 150, fuel: 'petrol' },
      transmission: 'dct',
      drive: 'fwd',
      tankLiters: 50,
      tireSizeFront: '205/55 R16',
      tireSizeRear: '205/55 R16',
      fluids: [{ kind: 'engineOil', spec: 'VW 504 00 5W-30', volumeL: 4.3 }],
    })
    renderAt(`/vehicle/${v.id}`)

    const specs = await screen.findByRole('list', { name: 'Характеристики' })
    expect(within(specs).getByText('TMBJJ7NE8G0123456')).toBeInTheDocument()
    expect(specs.textContent).toContain(`Двигатель1,4${NBSP}л · 150${NBSP}л.${NBSP}с. · CZDA`)
    expect(specs).toHaveTextContent('КПП')
    expect(specs).toHaveTextContent('Робот с двумя сцеплениями')
    expect(specs).toHaveTextContent('Передний')
    expect(specs.textContent).toContain(`Бак50${NBSP}л`)
    expect(specs).toHaveTextContent('ТопливоБензин')
    expect(specs).toHaveTextContent('Шины205/55 R16')
    expect(specs).toHaveTextContent('ПоколениеA7')

    const fluids = screen.getByRole('list', { name: 'Жидкости' })
    expect(fluids).toHaveTextContent('Моторное масло')
    expect(fluids).toHaveTextContent('VW 504 00 5W-30')
    expect(fluids.textContent).toContain(`4,3${NBSP}л`)
  })

  test('«Итого с покупкой и продажей» = расходы + покупка − продажа; «Проехал» — за владение', async () => {
    const v = await addVehicle({
      archived: true,
      purchase: { date: '2019-03-12', odometer: 45000, price: 100_000_000 },
      sale: { date: '2026-08-01', odometer: 150000, price: 80_000_000 },
    })
    await addFuel(v.id, '2026-07-01', 148000, 300_000)
    await repos.records.create({
      vehicleId: v.id,
      kind: 'expense',
      date: '2026-07-10',
      total: 700_000,
      category: 'tax',
    })
    renderAt(`/vehicle/${v.id}`)

    const own = await screen.findByRole('list', { name: 'Владение' })
    await waitFor(() => expect(own.textContent).toContain(`Расходы за всё время10${NBSP}000${NBSP}₽`))
    expect(own.textContent).toContain(`Итого с покупкой и продажей210${NBSP}000${NBSP}₽`)
    expect(own.textContent).toContain(`Проехал105${NBSP}000${NBSP}км`)
    expect(own.textContent).toContain(`12.03.2019 · 45${NBSP}000${NBSP}км · 1${NBSP}000${NBSP}000${NBSP}₽`)
    expect(own.textContent).toContain(`01.08.2026 · 150${NBSP}000${NBSP}км · 800${NBSP}000${NBSP}₽`)
  })

  test('проданная машина: в архиве, не активна, записи видны из карточки', async () => {
    await addVehicle({ name: 'Рапид' })
    const sold = await addVehicle({
      name: 'Старая Лада',
      archived: true,
      sale: { date: '2025-05-01', price: 30_000_000 },
    })
    await repos.records.create({
      vehicleId: sold.id,
      kind: 'note',
      date: '2025-04-20',
      total: 0,
      title: 'Сняли магнитолу перед продажей',
    })
    renderAt(`/vehicle/${sold.id}`)

    expect(await screen.findByText('Продана 01.05.2025')).toBeInTheDocument()
    expect(await screen.findByText('Сняли магнитолу перед продажей')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Владение' })).toHaveTextContent('Расходы за всё время')
    expect(screen.queryByRole('button', { name: 'Сделать активной' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Вернуть из архива' })).toBeInTheDocument()
    expect(await activeId()).not.toBe(sold.id)
    expect(screen.queryByText('Активная')).not.toBeInTheDocument()
  })

  test('«Сделать активной» меняет активную машину', async () => {
    const first = await addVehicle({ name: 'Рапид' })
    const second = await addVehicle({ name: 'Октавия' })
    await setMeta(db, META_KEYS.activeVehicleId, first.id)
    renderAt(`/vehicle/${second.id}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Сделать активной' }))
    await waitFor(async () => expect(await activeId()).toBe(second.id))
    expect(await screen.findByText('Активная')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Сделать активной' })).not.toBeInTheDocument()
  })

  test('«В архив» ставит archived: true, активной становится первая неархивная', async () => {
    const first = await addVehicle({ name: 'Рапид' })
    const second = await addVehicle({ name: 'Октавия' })
    await setMeta(db, META_KEYS.activeVehicleId, second.id)
    renderAt(`/vehicle/${second.id}`)

    await userEvent.click(await screen.findByRole('button', { name: 'В архив' }))
    await waitFor(async () => expect((await repos.vehicles.get(second.id))?.archived).toBe(true))
    await waitFor(async () => expect(await activeId()).toBe(first.id))
    expect(await screen.findByRole('button', { name: 'Вернуть из архива' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Вернуть из архива' }))
    await waitFor(async () => expect((await repos.vehicles.get(second.id))?.archived).toBe(false))
  })

  test('«Изменить» ведёт в форму машины', async () => {
    const v = await addVehicle()
    const router = renderAt(`/vehicle/${v.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Изменить' }))
    expect(router.state.location.pathname).toBe(`/vehicle/${v.id}/edit`)
  })

  test('ссылка «Журнал» неактивной машины делает её активной и открывает журнал', async () => {
    const first = await addVehicle({ name: 'Рапид' })
    const second = await addVehicle({ name: 'Октавия' })
    await setMeta(db, META_KEYS.activeVehicleId, first.id)
    const router = renderAt(`/vehicle/${second.id}`)

    await userEvent.click(await screen.findByRole('button', { name: /Журнал/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/journal'))
    expect(await activeId()).toBe(second.id)
  })

  test('несуществующая машина — «Машина не найдена»', async () => {
    renderAt('/vehicle/nope')
    expect(await screen.findByText('Машина не найдена')).toBeInTheDocument()
  })
})
