import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import type { FuelRecord } from '../../domain/types'
import { renderAt, vehicle } from './testUtils'

vi.setConfig({ testTimeout: 15_000 })

async function openFuel() {
  renderAt('/record/new/fuel')
  return screen.findByLabelText('Литры')
}

test('40 л × 56,90 ₽ — сумма 2 276 ₽', async () => {
  await userEvent.type(await openFuel(), '40')
  await userEvent.type(screen.getByLabelText('Цена за литр'), '56,90')
  expect(screen.getByLabelText('Сумма')).toHaveValue('2\u00a0276')
})

test('сумма 2 500 ₽ и 42,37 л — цена 59 ₽', async () => {
  const liters = await openFuel()
  await userEvent.type(screen.getByLabelText('Сумма'), '2500')
  await userEvent.type(liters, '42,37')
  await userEvent.tab()
  expect(screen.getByLabelText('Цена за литр')).toHaveValue('59')
})

test('последнее изменённое поле не перезаписывается: пересчитывается то, что правили раньше всех', async () => {
  const liters = await openFuel()
  await userEvent.type(liters, '40')
  await userEvent.type(screen.getByLabelText('Цена за литр'), '56,90')
  // Сумма посчитана; правим её — пересчитываются литры (их вводили раньше цены), цена остаётся.
  await userEvent.clear(screen.getByLabelText('Сумма'))
  expect(screen.getByLabelText('Сумма')).toHaveValue('')
  await userEvent.type(screen.getByLabelText('Сумма'), '2500')
  await userEvent.tab()
  expect(screen.getByLabelText('Цена за литр')).toHaveValue('56,90')
  expect(screen.getByLabelText('Литры')).toHaveValue('43,94')
})

test('без пробега — «Укажите пробег»', async () => {
  await userEvent.type(await openFuel(), '40')
  await userEvent.type(screen.getByLabelText('Цена за литр'), '56,90')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  expect(await screen.findByText('Укажите пробег')).toBeInTheDocument()
  expect(await db.records.count()).toBe(0)
})

test('без литров и цены — «Укажите литры и цену»', async () => {
  await openFuel()
  await userEvent.type(screen.getByLabelText('Пробег'), '148320')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  expect(await screen.findByText('Укажите литры и цену')).toBeInTheDocument()
  expect(await db.records.count()).toBe(0)
})

test('сохранённая заправка: литры, цена в копейках, сумма, полный бак, марка топлива машины', async () => {
  const router = renderAt('/record/new/fuel')
  await userEvent.type(await screen.findByLabelText('Пробег'), '148320')
  await userEvent.type(screen.getByLabelText('Литры'), '40')
  await userEvent.type(screen.getByLabelText('Цена за литр'), '56,90')
  expect(screen.getByRole('switch', { name: 'Полный бак' })).toBeChecked()
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\/[0-9a-f-]{36}$/))
  const [r] = (await db.records.toArray()) as FuelRecord[]
  expect(r).toMatchObject({
    kind: 'fuel',
    vehicleId: vehicle.id,
    odometer: 148320,
    liters: 40,
    pricePerLiter: 5690,
    total: 227600,
    fullTank: true,
    missedBefore: false,
    fuelGrade: 'АИ-95',
  })
})

test('«Пропустил заправку перед этой» и АЗС сохраняются', async () => {
  const station = await repos.places.create({ kind: 'fuel', name: 'Лукойл на Кольцевой' })
  const router = renderAt('/record/new/fuel')
  await userEvent.type(await screen.findByLabelText('Пробег'), '148320')
  await userEvent.type(screen.getByLabelText('Литры'), '30')
  await userEvent.type(screen.getByLabelText('Сумма'), '1800')
  await userEvent.click(screen.getByRole('switch', { name: 'Полный бак' }))
  await userEvent.click(screen.getByRole('switch', { name: 'Пропустил заправку перед этой' }))
  await userEvent.type(screen.getByRole('combobox', { name: 'АЗС' }), 'Лук')
  await userEvent.click(await screen.findByRole('option', { name: 'Лукойл на Кольцевой' }))
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\//))
  const [r] = (await db.records.toArray()) as FuelRecord[]
  expect(r).toMatchObject({
    liters: 30,
    pricePerLiter: 6000,
    total: 180000,
    fullTank: false,
    missedBefore: true,
    placeId: station.id,
  })
})

test('правка заправки показывает её значения', async () => {
  const rec = await repos.records.create({
    vehicleId: vehicle.id,
    kind: 'fuel',
    date: '2026-09-01',
    odometer: 148000,
    total: 227600,
    liters: 40,
    pricePerLiter: 5690,
    fullTank: false,
    missedBefore: false,
    fuelGrade: 'АИ-92',
  })
  renderAt(`/record/${rec.id}/edit`)
  expect(await screen.findByLabelText('Литры')).toHaveValue('40')
  expect(screen.getByLabelText('Цена за литр')).toHaveValue('56,90')
  expect(screen.getByLabelText('Сумма')).toHaveValue('2\u00a0276')
  expect(screen.getByRole('switch', { name: 'Полный бак' })).not.toBeChecked()
  expect(screen.getByRole('combobox', { name: 'Марка топлива' })).toHaveValue('АИ-92')
})
