import { cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import type { ExpenseRecord, NoteRecord } from '../../domain/types'
import { rememberDate, suggestedDate } from './form/lastDate'
import { renderAt, vehicle } from './testUtils'

test('пробег: сохраняется и открывается карточка', async () => {
  const router = renderAt('/record/new/odometer')
  await userEvent.clear(await screen.findByLabelText('Пробег'))
  await userEvent.type(screen.getByLabelText('Пробег'), '148320')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\/[0-9a-f-]{36}$/))
  const [r] = await db.records.toArray()
  expect(r).toMatchObject({ kind: 'odometer', odometer: 148320, total: 0, vehicleId: vehicle.id })
})

test('расход без суммы — ошибка у поля', async () => {
  renderAt('/record/new/expense')
  await userEvent.click(await screen.findByRole('button', { name: 'Сохранить' }))
  expect(await screen.findByText('Укажите сумму')).toBeInTheDocument()
  expect(await db.records.count()).toBe(0)
})

test('ОСАГО: поля срока действия', async () => {
  renderAt('/record/new/expense')
  await userEvent.selectOptions(await screen.findByLabelText('Категория'), 'osago')
  expect(screen.getByLabelText('Действует до')).toBeInTheDocument()
})

test('пробег меньше более ранней записи — предупреждение', async () => {
  await repos.records.create({
    vehicleId: vehicle.id,
    kind: 'odometer',
    date: '2026-02-01',
    odometer: 1500,
    total: 0,
  })
  renderAt('/record/new/odometer')
  const dateInput = await screen.findByLabelText('Дата')
  await userEvent.clear(dateInput)
  await userEvent.type(dateInput, '2026-02-15')
  await userEvent.clear(screen.getByLabelText('Пробег'))
  await userEvent.type(screen.getByLabelText('Пробег'), '1400')
  expect(await screen.findByText(/Раньше, 01\.02\.2026, было 1\s500\sкм/)).toBeInTheDocument()
})

test('дата прошлой записи предлагается следующей', async () => {
  sessionStorage.clear()
  const first = renderAt('/record/new/odometer')
  const date = await screen.findByLabelText('Дата')
  await userEvent.clear(date)
  await userEvent.type(date, '2024-03-12')
  await userEvent.clear(screen.getByLabelText('Пробег'))
  await userEvent.type(screen.getByLabelText('Пробег'), '90000')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(first.state.location.pathname).toMatch(/^\/record\//))
  cleanup()
  renderAt('/record/new/note')
  await userEvent.click(await screen.findByRole('button', { name: 'Как в прошлой записи: 12.03.2024' }))
  expect(screen.getByLabelText('Дата')).toHaveValue('2024-03-12')
})

describe('хронология пробега', () => {
  test('больше более поздней записи — «Позже, …»', async () => {
    await repos.records.create({
      vehicleId: vehicle.id,
      kind: 'odometer',
      date: '2026-03-01',
      odometer: 2000,
      total: 0,
    })
    renderAt('/record/new/odometer')
    const dateInput = await screen.findByLabelText('Дата')
    await userEvent.clear(dateInput)
    await userEvent.type(dateInput, '2026-02-15')
    await userEvent.clear(screen.getByLabelText('Пробег'))
    await userEvent.type(screen.getByLabelText('Пробег'), '2500')
    expect(await screen.findByText(/Позже, 01\.03\.2026, было 2\s000\sкм/)).toBeInTheDocument()
  })

  test('в тот же день с большой разницей — «В тот же день, …», сохранить можно', async () => {
    await repos.records.create({
      vehicleId: vehicle.id,
      kind: 'odometer',
      date: '2026-02-01',
      odometer: 150000,
      total: 0,
    })
    const router = renderAt('/record/new/odometer')
    const dateInput = await screen.findByLabelText('Дата')
    await userEvent.clear(dateInput)
    await userEvent.type(dateInput, '2026-02-01')
    await userEvent.clear(screen.getByLabelText('Пробег'))
    await userEvent.type(screen.getByLabelText('Пробег'), '15000')
    expect(await screen.findByText(/В тот же день, 01\.02\.2026, было 150\s000\sкм/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\/[0-9a-f-]{36}$/))
    expect(await db.records.count()).toBe(2)
  })
})

test('новая запись предзаполняет текущий пробег, заметка — нет', async () => {
  await repos.records.create({
    vehicleId: vehicle.id,
    kind: 'odometer',
    date: '2026-02-01',
    odometer: 148320,
    total: 0,
  })
  renderAt('/record/new/expense')
  expect(await screen.findByLabelText('Пробег')).toHaveValue('148\u00a0320')
  cleanup()
  renderAt('/record/new/note')
  expect(await screen.findByLabelText('Пробег')).toHaveValue('')
})

test('пробег без значения — ошибка у поля', async () => {
  renderAt('/record/new/odometer')
  await userEvent.click(await screen.findByRole('button', { name: 'Сохранить' }))
  expect(await screen.findByText('Укажите пробег')).toBeInTheDocument()
  expect(await db.records.count()).toBe(0)
})

test('заметка без названия — ошибка; с названием сохраняется без пробега', async () => {
  const router = renderAt('/record/new/note')
  await userEvent.click(await screen.findByRole('button', { name: 'Сохранить' }))
  expect(await screen.findByText('Добавьте название')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Название'), 'Стук справа')
  await userEvent.type(screen.getByLabelText('Текст'), 'На кочках, после 20 км')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\/[0-9a-f-]{36}$/))
  const [r] = (await db.records.toArray()) as NoteRecord[]
  expect(r).toMatchObject({ kind: 'note', title: 'Стук справа', note: 'На кочках, после 20 км', total: 0 })
  expect(r!.odometer).toBeUndefined()
})

test('расход ОСАГО сохраняется со сроком и номером полиса', async () => {
  const router = renderAt('/record/new/expense')
  await userEvent.selectOptions(await screen.findByLabelText('Категория'), 'osago')
  await userEvent.type(screen.getByLabelText('Сумма'), '8500')
  await userEvent.type(screen.getByLabelText('Действует с'), '2026-09-01')
  await userEvent.type(screen.getByLabelText('Действует до'), '2027-08-31')
  await userEvent.type(screen.getByLabelText('Номер полиса'), 'ХХХ 0123456789')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\/[0-9a-f-]{36}$/))
  const [r] = (await db.records.toArray()) as ExpenseRecord[]
  expect(r).toMatchObject({
    kind: 'expense',
    category: 'osago',
    total: 850000,
    validFrom: '2026-09-01',
    validUntil: '2027-08-31',
    docNumber: 'ХХХ 0123456789',
  })
})

test('правка записи сохраняет изменения в той же строке', async () => {
  const rec = await repos.records.create({
    vehicleId: vehicle.id,
    kind: 'expense',
    category: 'wash',
    date: '2026-09-01',
    total: 50000,
    title: 'Мойка',
  })
  renderAt(`/record/${rec.id}/edit`)
  const amount = await screen.findByLabelText('Сумма')
  expect(amount).toHaveValue('500')
  await userEvent.clear(amount)
  await userEvent.type(amount, '700')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(async () => expect((await repos.records.get(rec.id))?.total).toBe(70000))
  expect(await db.records.count()).toBe(1)
})

test('правка несуществующей записи — «Запись не найдена»', async () => {
  renderAt('/record/nope/edit')
  expect(await screen.findByText('Запись не найдена')).toBeInTheDocument()
})

test('неизвестный вид записи — «Страница не найдена»', async () => {
  renderAt('/record/new/boat')
  expect(await screen.findByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument()
})

describe('lastDate', () => {
  test('помнит дату сессии и предлагает её, только если она не сегодня', () => {
    sessionStorage.clear()
    expect(suggestedDate('2026-09-25')).toBeNull()
    rememberDate('2024-03-12')
    expect(suggestedDate('2026-09-25')).toBe('2024-03-12')
    rememberDate('2026-09-25')
    expect(suggestedDate('2026-09-25')).toBeNull()
  })
})
