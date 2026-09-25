import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { todayISO } from '../../domain/dates'
import type { ServiceRecord } from '../../domain/types'
import { renderAt, vehicle } from './testUtils'

vi.setConfig({ testTimeout: 15_000 })

const service = (s: Partial<ServiceRecord> = {}) =>
  repos.records.create({
    vehicleId: vehicle.id,
    kind: 'service',
    date: '2026-03-12',
    odometer: 140200,
    total: 330000,
    title: 'ТО-6',
    serviceType: 'maintenance',
    diy: false,
    works: [{ id: 'w1', name: 'Замена масла', price: 200000 }],
    parts: [
      {
        id: 'p1',
        name: 'Масляный фильтр',
        brand: 'Mann-Filter',
        partNumber: 'W 712/95',
        qty: 2,
        unit: 'pcs',
        unitPrice: 65000,
        ownPart: false,
      },
    ],
    ...s,
  })

test('ТО: запчасть показывает бренд и артикул, работы, итог', async () => {
  const r = await service()
  renderAt(`/record/${r.id}`)
  expect(await screen.findByRole('heading', { name: 'ТО-6' })).toBeInTheDocument()
  expect(screen.getByText(/Mann-Filter · W 712\/95/)).toBeInTheDocument()
  expect(screen.getByText('Замена масла')).toBeInTheDocument()
  expect(screen.getByText('12 марта 2026')).toBeInTheDocument()
  expect(screen.getAllByText('3 300 ₽').length).toBeGreaterThan(0)
})

test('ТО с ручным итогом показывает и сумму строк', async () => {
  const r = await service({ total: 400000 })
  renderAt(`/record/${r.id}`)
  expect(await screen.findByText('По строкам')).toBeInTheDocument()
  expect(screen.getByText('3 300 ₽')).toBeInTheDocument()
  expect(screen.getAllByText('4 000 ₽').length).toBeGreaterThan(0)
})

test('место и мастер — ссылки на свои карточки', async () => {
  const place = await repos.places.create({ kind: 'service', name: 'Автосервис на Ленина' })
  const master = await repos.masters.create({ name: 'Сергей', placeId: place.id })
  const r = await service({ placeId: place.id, masterId: master.id })
  const router = renderAt(`/record/${r.id}`)
  await userEvent.click(await screen.findByRole('button', { name: /Автосервис на Ленина/ }))
  await waitFor(() => expect(router.state.location.pathname).toBe(`/places/${place.id}`))
  router.navigate(-1)
  await userEvent.click(await screen.findByRole('button', { name: /Сергей/ }))
  await waitFor(() => expect(router.state.location.pathname).toBe(`/masters/${master.id}`))
})

test('заправка: расход с прошлого полного бака', async () => {
  const fill = {
    vehicleId: vehicle.id,
    kind: 'fuel' as const,
    fullTank: true,
    missedBefore: false,
    pricePerLiter: 5690,
  }
  await repos.records.create({ ...fill, date: '2026-09-01', odometer: 147800, liters: 40, total: 227600 })
  const r = await repos.records.create({
    ...fill,
    date: '2026-09-12',
    odometer: 148320,
    liters: 40.56,
    total: 230786,
  })
  renderAt(`/record/${r.id}`)
  expect(await screen.findByText('с прошлого полного бака')).toBeInTheDocument()
  expect(await screen.findByText('7,8 л/100 км')).toBeInTheDocument()
  expect(screen.getByText('40,56 л')).toBeInTheDocument()
  expect(screen.getByText('56,90 ₽')).toBeInTheDocument()
})

test('расход: категория, срок действия и номер полиса', async () => {
  const r = await repos.records.create({
    vehicleId: vehicle.id,
    kind: 'expense',
    date: '2026-08-20',
    total: 850000,
    category: 'osago',
    validFrom: '2026-08-21',
    validUntil: '2027-08-20',
    docNumber: 'ХХХ 0123456789',
  })
  renderAt(`/record/${r.id}`)
  expect(await screen.findByText('ОСАГО', { selector: 'span' })).toBeInTheDocument()
  expect(screen.getByText('21.08.2026 — 20.08.2027')).toBeInTheDocument()
  expect(screen.getByText('ХХХ 0123456789')).toBeInTheDocument()
})

test('заметка: текст', async () => {
  const r = await repos.records.create({
    vehicleId: vehicle.id,
    kind: 'note',
    date: '2026-09-05',
    total: 0,
    title: 'Стук справа',
    note: 'На кочках, на холодную',
  })
  renderAt(`/record/${r.id}`)
  expect(await screen.findByText('На кочках, на холодную')).toBeInTheDocument()
})

test('удаление с подтверждением, «Отменить» возвращает запись', async () => {
  const r = await service()
  const router = renderAt(`/record/${r.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Удалить' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Удалить запись?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }))
  await waitFor(async () => expect((await db.records.get(r.id))?.deleted).toBe(true))
  await waitFor(() => expect(router.state.location.pathname).not.toBe(`/record/${r.id}`))
  expect(await screen.findByText('Запись удалена')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Отменить' }))
  await waitFor(async () => expect((await db.records.get(r.id))?.deleted).toBe(false))
})

test('«Повторить» создаёт копию на сегодня и открывает её правку; сохранение ведёт на карточку копии', async () => {
  const r = await service()
  const router = renderAt(`/record/${r.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Повторить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\/[0-9a-f-]{36}\/edit$/))
  const copyId = router.state.location.pathname.split('/')[2]!
  expect(copyId).not.toBe(r.id)
  const copy = (await db.records.get(copyId)) as ServiceRecord
  expect(copy).toMatchObject({ title: 'ТО-6', date: todayISO(), works: [{ name: 'Замена масла' }] })
  expect(await screen.findByRole('heading', { name: 'Копия записи' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(`/record/${copyId}`))
})

test('«Назад» из правки копии убирает копию и возвращает к записи', async () => {
  const r = await service()
  const router = renderAt(`/record/${r.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Повторить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/\/edit$/))
  const copyId = router.state.location.pathname.split('/')[2]!
  await userEvent.click(await screen.findByRole('button', { name: 'Назад' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(`/record/${r.id}`))
  await waitFor(async () => expect((await db.records.get(copyId))?.deleted).toBe(true))
})

test('«Изменить» открывает правку', async () => {
  const r = await service()
  const router = renderAt(`/record/${r.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Изменить' }))
  await waitFor(() => expect(router.state.location.pathname).toBe(`/record/${r.id}/edit`))
})

test('удалённая или несуществующая запись — «Запись не найдена»', async () => {
  const r = await service()
  await repos.records.remove(r.id)
  renderAt(`/record/${r.id}`)
  expect(await screen.findByText('Запись не найдена')).toBeInTheDocument()
})
