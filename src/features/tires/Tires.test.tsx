import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { NBSP } from '../../domain/format'
import type { ID, TireSet } from '../../domain/types'
import { ToastProvider } from '../../ui'
import TireSetPage from './TireSetPage'
import TiresPage from './TiresPage'

vi.mock('../../sync/index', () => ({
  attachmentStore: {
    addFile: vi.fn(),
    remove: vi.fn(),
    getThumbUrl: async (att: { id: string }) => `blob:thumb-${att.id}`,
    getOriginalUrl: async (att: { id: string }) => `blob:orig-${att.id}`,
  },
  syncEngine: { subscribe: () => () => {}, getStatus: () => ({ state: 'off', pendingUploads: 0 }) },
  yandexAuth: { subscribe: () => () => {}, isConnected: () => false, getLoginError: () => null },
}))

beforeEach(async () => {
  await db.open()
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

function renderAt(path: string, history: string[] = []) {
  const router = createMemoryRouter(
    [
      { path: '/tires', element: <TiresPage /> },
      { path: '/tires/new', element: <TireSetPage /> },
      { path: '/tires/:id', element: <TireSetPage /> },
      { path: '*', element: <p>Другой экран</p> },
    ],
    { initialEntries: [...history, path], initialIndex: history.length },
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
    tireSizeFront: '205/55 R16',
  })

const addSet = (vehicleId: ID, patch: Partial<TireSet>) =>
  repos.tireSets.create({ vehicleId, season: 'summer', count: 4, status: 'stored', ...patch })

const swap = (vehicleId: ID, date: string, odometer: number, mountedSetId?: ID, removedSetId?: ID) =>
  repos.records.create({
    vehicleId,
    kind: 'service',
    date,
    odometer,
    total: 200_000,
    title: 'Переобувка',
    serviceType: 'tires',
    diy: false,
    works: [],
    parts: [],
    tireSwap: { mountedSetId, removedSetId },
  })

/** Записи статуса комплектов в базу (создание и правка) по порядку, с транзакцией каждой записи. */
function watchStatusWrites() {
  const log: { id: ID; status: string; tx: unknown }[] = []
  const onCreate = function (_key: unknown, obj: TireSet, tx: unknown) {
    log.push({ id: obj.id, status: obj.status, tx })
  }
  const onUpdate = function (mods: Partial<TireSet>, key: unknown, _obj: TireSet, tx: unknown) {
    if (mods.status) log.push({ id: key as ID, status: mods.status, tx })
  }
  db.tireSets.hook('creating', onCreate)
  db.tireSets.hook('updating', onUpdate)
  return {
    log,
    stop() {
      db.tireSets.hook('creating').unsubscribe(onCreate)
      db.tireSets.hook('updating').unsubscribe(onUpdate)
    },
  }
}

/** Зима стояла с 10 000 до 16 000 км, с 16 000 — лето; сейчас 20 000 км. */
async function seasonHistory() {
  const v = await addVehicle()
  const winter = await addSet(v.id, {
    season: 'winter',
    brand: 'Nokian',
    model: 'Hakkapeliitta 10',
    size: '205/55 R16',
    dot: '2423',
    studded: true,
    status: 'stored',
  })
  const summer = await addSet(v.id, {
    season: 'summer',
    brand: 'Michelin',
    model: 'Primacy 4',
    status: 'installed',
  })
  await swap(v.id, '2025-11-01', 10_000, winter.id)
  await swap(v.id, '2026-04-01', 16_000, summer.id, winter.id)
  await repos.records.create({
    vehicleId: v.id,
    kind: 'odometer',
    date: '2026-09-01',
    odometer: 20_000,
    total: 0,
  })
  return { v, winter, summer }
}

describe('список комплектов', () => {
  test('группы по состоянию; строка: название и размер, сезон, шипы, DOT, пробег комплекта', async () => {
    await seasonHistory()
    renderAt('/tires')

    const installed = await screen.findByRole('list', { name: 'Установлены' })
    const summerRow = within(installed).getByRole('button', { name: /Michelin/ })
    await waitFor(() => expect(summerRow.textContent).toContain(`4${NBSP}000${NBSP}км`))

    const stored = screen.getByRole('list', { name: 'На хранении' })
    const winterRow = within(stored).getByRole('button', { name: /Nokian/ })
    expect(winterRow).toHaveTextContent('Nokian Hakkapeliitta 10 · 205/55 R16')
    expect(winterRow.textContent).toContain(`Зимние · шипы · DOT 2023, 24${NBSP}неделя`)
    await waitFor(() => expect(winterRow.textContent).toContain(`6${NBSP}000${NBSP}км`))
    expect(screen.queryByRole('list', { name: 'Списаны' })).not.toBeInTheDocument()
  })

  test('«Добавить комплект» открывает форму', async () => {
    await addVehicle()
    const router = renderAt('/tires')
    await userEvent.click(await screen.findByRole('button', { name: 'Добавить комплект' }))
    expect(router.state.location.pathname).toBe('/tires/new')
  })
})

describe('карточка комплекта', () => {
  test('пробег комплекта и история смен шин', async () => {
    const { winter } = await seasonHistory()
    renderAt(`/tires/${winter.id}`)

    const summary = await screen.findByRole('region', { name: 'Комплект' })
    await waitFor(() => expect(summary.textContent).toContain(`Пробег комплекта6${NBSP}000${NBSP}км`))
    const history = await screen.findByRole('list', { name: 'История' })
    await waitFor(() => expect(within(history).getAllByRole('button')).toHaveLength(2))
    const rows = within(history).getAllByRole('button')
    expect(rows[0]).toHaveTextContent('Сняты')
    expect(rows[1]).toHaveTextContent('Установлены')
    expect(screen.getByRole('textbox', { name: 'DOT' })).toHaveAccessibleDescription(`2023, 24${NBSP}неделя`)
  })

  test('«Отметить установленным» переводит прежний установленный комплект в «На хранении»', async () => {
    const { winter, summer } = await seasonHistory()
    const other = await addVehicle()
    const foreign = await addSet(other.id, { status: 'installed' })
    renderAt(`/tires/${winter.id}`)

    const writes = watchStatusWrites()
    await userEvent.click(await screen.findByRole('button', { name: 'Отметить установленным' }))
    await waitFor(async () => {
      expect((await repos.tireSets.get(winter.id))?.status).toBe('installed')
      expect((await repos.tireSets.get(summer.id))?.status).toBe('stored')
    })
    expect((await repos.tireSets.get(foreign.id))?.status).toBe('installed')
    // Сначала прежний уходит на хранение, потом новый ставится — в одной транзакции: двух установленных не видно никогда.
    expect(writes.log.map((w) => [w.id, w.status])).toEqual([
      [summer.id, 'stored'],
      [winter.id, 'installed'],
    ])
    expect(writes.log[0]!.tx).toBe(writes.log[1]!.tx)
    writes.stop()
    expect(await screen.findByText('Комплект установлен, прежний — на хранении')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Отметить установленным' })).not.toBeInTheDocument(),
    )
  })

  test('новый комплект: размер из машины, сохраняется; «установлен» снимает прежний', async () => {
    const v = await addVehicle()
    const old = await addSet(v.id, { status: 'installed', brand: 'Старые' })
    const router = renderAt('/tires/new', ['/tires'])

    await userEvent.click(await screen.findByRole('radio', { name: 'Зимние' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Бренд' }), 'Nokian')
    await userEvent.type(screen.getByRole('textbox', { name: 'Модель' }), 'Nordman 8')
    expect(screen.getByRole('textbox', { name: 'Размер' })).toHaveValue('205/55 R16')
    await userEvent.type(screen.getByRole('textbox', { name: 'DOT' }), '3822')
    await userEvent.click(screen.getByRole('switch', { name: 'Шипы' }))
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Состояние' }), 'Установлены')
    const writes = watchStatusWrites()
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/tires'))
    expect(writes.log.map((w) => w.status)).toEqual(['stored', 'installed'])
    expect(writes.log[0]!.tx).toBe(writes.log[1]!.tx)
    writes.stop()
    const sets = await repos.tireSets.list()
    const created = sets.find((s) => s.id !== old.id)
    expect(created).toMatchObject({
      vehicleId: v.id,
      season: 'winter',
      brand: 'Nokian',
      model: 'Nordman 8',
      size: '205/55 R16',
      dot: '3822',
      studded: true,
      count: 4,
      status: 'installed',
    })
    expect((await repos.tireSets.get(old.id))?.status).toBe('stored')
  })

  test('неверный DOT — ошибка у поля, комплект не сохраняется', async () => {
    await addVehicle()
    renderAt('/tires/new', ['/tires'])
    await userEvent.type(await screen.findByRole('textbox', { name: 'DOT' }), '9923')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    const dot = screen.getByRole('textbox', { name: 'DOT' })
    await waitFor(() => expect(dot).toHaveAttribute('aria-invalid', 'true'))
    expect(dot).toHaveAccessibleDescription('Четыре цифры: неделя и год, например 2423')
    expect(await repos.tireSets.list()).toHaveLength(0)
  })

  test('пустое «Количество» — ошибка у поля, комплект не сохраняется (а не молча 4)', async () => {
    await addVehicle()
    const router = renderAt('/tires/new', ['/tires'])
    const count = await screen.findByRole('textbox', { name: 'Количество' })
    await userEvent.clear(count)
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(count).toHaveAttribute('aria-invalid', 'true'))
    expect(count).toHaveAccessibleDescription('Укажите количество')
    expect(await repos.tireSets.list()).toHaveLength(0)
    expect(router.state.location.pathname).toBe('/tires/new')

    // Ввели — ошибка уходит, комплект сохраняется с этим количеством.
    await userEvent.type(count, '2')
    expect(count).not.toHaveAttribute('aria-invalid', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/tires'))
    expect((await repos.tireSets.list())[0]).toMatchObject({ count: 2 })
  })

  test('удаление комплекта — с «Отменить»', async () => {
    const v = await addVehicle()
    const set = await addSet(v.id, { brand: 'Nokian' })
    renderAt(`/tires/${set.id}`, ['/tires'])
    await userEvent.click(await screen.findByRole('button', { name: 'Удалить комплект' }))
    await waitFor(async () => expect(await repos.tireSets.get(set.id)).toBeUndefined())
    expect(await screen.findByText('Комплект удалён')).toBeInTheDocument()
  })
})
