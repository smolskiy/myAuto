import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import type { CarRecord } from '../../domain/types'
import { renderAt, vehicle } from '../records/testUtils'
import { groupByMonth } from './groupByMonth'

vi.setConfig({ testTimeout: 15_000 })

beforeAll(async () => {
  await import('./JournalPage')
})

const base = { id: '', createdAt: 0, updatedAt: 0, vehicleId: 'v' }
const rec = (id: string, date: string, total: number, kind: CarRecord['kind'] = 'odometer') =>
  ({ ...base, id, date, total, kind }) as CarRecord

describe('groupByMonth', () => {
  test('месяцы от новых к старым, записи в порядке входа, итог — сумма', () => {
    const groups = groupByMonth([
      rec('a', '2026-09-12', 200000),
      rec('b', '2026-09-01', 500000),
      rec('c', '2026-08-20', 850000),
      rec('d', '2026-08-05', 0),
    ])
    expect(groups.map((g) => [g.month, g.total, g.records.map((r) => r.id)])).toEqual([
      ['2026-09', 700000, ['a', 'b']],
      ['2026-08', 850000, ['c', 'd']],
    ])
  })

  test('несортированный вход — месяцы всё равно по убыванию', () => {
    const groups = groupByMonth([
      rec('a', '2025-01-10', 1),
      rec('b', '2026-03-01', 2),
      rec('c', '2025-01-02', 3),
    ])
    expect(groups.map((g) => g.month)).toEqual(['2026-03', '2025-01'])
    expect(groups[1]!.records.map((r) => r.id)).toEqual(['a', 'c'])
  })

  test('пусто — пусто', () => {
    expect(groupByMonth([])).toEqual([])
  })
})

async function seed() {
  const service = await repos.records.create({
    vehicleId: vehicle.id,
    kind: 'service',
    date: '2026-09-12',
    odometer: 148320,
    total: 1035000,
    title: 'ТО-6',
    serviceType: 'maintenance',
    diy: false,
    works: [],
    parts: [
      {
        id: 'p1',
        itemId: 'item.oil_filter',
        name: 'Масляный фильтр',
        brand: 'Mann-Filter',
        partNumber: 'W 712/95',
        qty: 1,
        unit: 'pcs',
        unitPrice: 65000,
        ownPart: false,
      },
    ],
  })
  const fuel = await repos.records.create({
    vehicleId: vehicle.id,
    kind: 'fuel',
    date: '2026-09-05',
    odometer: 147900,
    total: 227600,
    liters: 40,
    pricePerLiter: 5690,
    fullTank: true,
    missedBefore: false,
  })
  const wash = await repos.records.create({
    vehicleId: vehicle.id,
    kind: 'expense',
    date: '2026-08-20',
    total: 50000,
    category: 'wash',
    title: 'Мойка кузова',
  })
  return { service, fuel, wash }
}

test('месяцы с итогами и строки записей', async () => {
  await seed()
  renderAt('/journal')
  expect(await screen.findByRole('heading', { name: 'Сентябрь\u00a02026' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Август\u00a02026' })).toBeInTheDocument()
  expect(screen.getByText('12 626 ₽')).toBeInTheDocument()
  expect(screen.getByText('ТО-6')).toBeInTheDocument()
  expect(screen.getByText('Заправка · 40 л')).toBeInTheDocument()
  expect(screen.getByText('Мойка кузова')).toBeInTheDocument()
})

test('поиск по артикулу находит запись', async () => {
  await seed()
  renderAt('/journal')
  await screen.findByText('ТО-6')
  await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск по журналу' }), 'W 712')
  await waitFor(() => expect(screen.queryByText('Мойка кузова')).not.toBeInTheDocument())
  expect(screen.getByText('ТО-6')).toBeInTheDocument()
  expect(screen.queryByText('Заправка · 40 л')).not.toBeInTheDocument()
})

test('чип «Заправка» оставляет только заправки', async () => {
  await seed()
  renderAt('/journal')
  await screen.findByText('ТО-6')
  await userEvent.click(screen.getByRole('button', { name: 'Заправка', pressed: false }))
  await waitFor(() => expect(screen.queryByText('ТО-6')).not.toBeInTheDocument())
  expect(screen.getByText('Заправка · 40 л')).toBeInTheDocument()
  expect(screen.queryByText('Мойка кузова')).not.toBeInTheDocument()
})

test('строка открывает карточку записи', async () => {
  const { fuel } = await seed()
  const router = renderAt('/journal')
  await userEvent.click(await screen.findByText('Заправка · 40 л'))
  await waitFor(() => expect(router.state.location.pathname).toBe(`/record/${fuel.id}`))
})

test('удаление из меню строки и «Отменить»', async () => {
  const { wash } = await seed()
  renderAt('/journal')
  const row = (await screen.findByText('Мойка кузова')).closest('li')!
  await userEvent.click(within(row).getByRole('button', { name: 'Действия' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Удалить' }))
  await waitFor(() => expect(screen.queryByText('Мойка кузова')).not.toBeInTheDocument())
  expect((await db.records.get(wash.id))?.deleted).toBe(true)
  await userEvent.click(await screen.findByRole('button', { name: 'Отменить' }))
  expect(await screen.findByText('Мойка кузова')).toBeInTheDocument()
})

test('«Повторить» из меню строки открывает форму копии, ничего не записывая', async () => {
  const { wash } = await seed()
  const router = renderAt('/journal')
  const row = (await screen.findByText('Мойка кузова')).closest('li')!
  await userEvent.click(within(row).getByRole('button', { name: 'Действия' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Повторить' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/record/new/expense'))
  expect(router.state.location.search).toBe(`?from=${wash.id}`)
  expect(await screen.findByRole('heading', { name: 'Копия записи' })).toBeInTheDocument()
  expect(await db.records.count()).toBe(3)
})

test('фильтр по месту из шторки «Фильтры» и число активных фильтров', async () => {
  await seed()
  const station = await repos.places.create({ kind: 'fuel', name: 'Лукойл' })
  await repos.records.create({
    vehicleId: vehicle.id,
    kind: 'fuel',
    date: '2026-09-10',
    odometer: 148100,
    total: 100000,
    liters: 20,
    pricePerLiter: 5000,
    fullTank: false,
    missedBefore: false,
    placeId: station.id,
  })
  renderAt('/journal')
  await screen.findByText('ТО-6')
  await userEvent.click(screen.getByRole('button', { name: 'Фильтры' }))
  const sheet = await screen.findByRole('dialog', { name: 'Фильтры' })
  await userEvent.type(within(sheet).getByRole('combobox', { name: 'Место' }), 'Лук')
  await userEvent.click(await within(sheet).findByRole('option', { name: 'Лукойл' }))
  await userEvent.click(within(sheet).getByRole('button', { name: 'Показать' }))
  await waitFor(() => expect(screen.queryByText('ТО-6')).not.toBeInTheDocument())
  expect(screen.getByText('Заправка · 20 л')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Фильтры/ })).toHaveTextContent('1')
})

test('период «Свой» ограничивает даты', async () => {
  await seed()
  renderAt('/journal')
  await screen.findByText('ТО-6')
  await userEvent.click(screen.getByRole('button', { name: 'Фильтры' }))
  const sheet = await screen.findByRole('dialog', { name: 'Фильтры' })
  await userEvent.click(within(sheet).getByRole('button', { name: 'Свой' }))
  await userEvent.type(within(sheet).getByLabelText('С'), '2026-08-01')
  await userEvent.type(within(sheet).getByLabelText('По'), '2026-08-31')
  await userEvent.click(within(sheet).getByRole('button', { name: 'Показать' }))
  await waitFor(() => expect(screen.queryByText('ТО-6')).not.toBeInTheDocument())
  expect(screen.getByText('Мойка кузова')).toBeInTheDocument()
})

test('пусто — «Записей пока нет» с «Добавить запись»', async () => {
  renderAt('/journal')
  const empty = (await screen.findByText('Записей пока нет')).parentElement!
  // У нижней панели своя «+» с тем же именем — берём кнопку пустого журнала.
  await userEvent.click(within(empty).getByRole('button', { name: 'Добавить запись' }))
  expect(await screen.findByRole('dialog', { name: 'Новая запись' })).toBeInTheDocument()
})

test('ничего не найдено — «Сбросить фильтры» возвращает всё', async () => {
  await seed()
  renderAt('/journal')
  await screen.findByText('ТО-6')
  await userEvent.type(screen.getByRole('searchbox', { name: 'Поиск по журналу' }), 'нет такого')
  expect(await screen.findByText('Ничего не найдено')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
  expect(await screen.findByText('ТО-6')).toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Поиск по журналу' })).toHaveValue('')
})
