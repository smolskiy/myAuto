import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider } from 'react-router'
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { AppProviders } from '../../app/providers'
import { createAppRouter } from '../../app/routes'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { BUILTIN_CATALOG, CATALOG_ID, STARTER_REMINDER_ITEM_IDS } from '../../domain/catalog'
import { NBSP } from '../../domain/format'
import { yandexAuth } from '../../sync/index'
import { goToUrl } from '../settings/leave'

vi.mock('../settings/leave', () => ({ goToUrl: vi.fn(), reloadPage: vi.fn() }))

vi.setConfig({ testTimeout: 20_000 })

const renderAt = (path: string) => {
  const router = createAppRouter({ initialPath: path })
  render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return router
}

beforeAll(async () => {
  await import('./OnboardingPage')
})
beforeEach(async () => {
  await db.open()
  vi.mocked(goToUrl).mockClear()
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  vi.unstubAllEnvs()
  history.replaceState(null, '', '/')
})

async function addVehicleStep() {
  await userEvent.type(await screen.findByLabelText('Марка'), 'Skoda')
  await userEvent.type(screen.getByLabelText('Модель'), 'Octavia')
  await userEvent.click(screen.getByRole('button', { name: 'Дальше' }))
  await screen.findByRole('heading', { name: 'Что напоминать' })
}

test('полный проход без Диска: машина, 8 правил из каталога, «Позже» — на главную', async () => {
  const router = renderAt('/onboarding')
  expect(await screen.findByRole('heading', { name: 'Добавьте машину' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Добро пожаловать' })).toBeInTheDocument()
  await addVehicleStep()
  for (const id of STARTER_REMINDER_ITEM_IDS) {
    const name = BUILTIN_CATALOG.find((i) => i.id === id)!.name
    expect(screen.getByRole('checkbox', { name })).toBeChecked()
  }
  await userEvent.click(screen.getByRole('button', { name: 'Дальше' }))
  expect(await screen.findByRole('heading', { name: 'Синхронизация' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Позже' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/'))

  const [vehicle, ...rest] = await db.vehicles.toArray()
  expect(rest).toHaveLength(0)
  expect(vehicle).toMatchObject({ name: 'Skoda Octavia', archived: false })
  const rules = await db.reminderRules.toArray()
  expect(rules).toHaveLength(8)
  expect(rules.map((r) => r.itemId).sort()).toEqual([...STARTER_REMINDER_ITEM_IDS].sort())
  const oil = rules.find((r) => r.itemId === CATALOG_ID.engineOil)!
  expect(oil).toMatchObject({ vehicleId: vehicle!.id, intervalKm: 10000, intervalMonths: 12, enabled: true })
  expect(oil.baseline).toBeUndefined()
})

test('снятый флажок не создаёт правило; пробег «последний раз» уходит в baseline', async () => {
  renderAt('/onboarding')
  await addVehicleStep()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Свечи зажигания' }))
  await userEvent.type(screen.getByLabelText('Моторное масло: когда делали последний раз'), '140000')
  await userEvent.click(screen.getByRole('button', { name: 'Дальше' }))
  await screen.findByRole('heading', { name: 'Синхронизация' })

  const rules = await db.reminderRules.toArray()
  expect(rules).toHaveLength(7)
  expect(rules.some((r) => r.itemId === CATALOG_ID.sparkPlugs)).toBe(false)
  expect(rules.find((r) => r.itemId === CATALOG_ID.engineOil)!.baseline).toEqual({ odometer: 140000 })
})

test('правила создаются одной транзакцией: сбой на середине не оставляет половину', async () => {
  const create = repos.reminders.create
  let n = 0
  vi.spyOn(repos.reminders, 'create').mockImplementation(async (draft) => {
    if (++n === 3) throw new Error('сбой записи')
    return create(draft)
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  renderAt('/onboarding')
  await addVehicleStep()
  await userEvent.click(screen.getByRole('button', { name: 'Дальше' }))
  expect(await screen.findByText('Не получилось сохранить — попробуйте ещё раз')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Что напоминать' })).toBeInTheDocument()
  expect(await db.reminderRules.count()).toBe(0)
})

test('интервалы узлов подписаны из каталога', async () => {
  renderAt('/onboarding')
  await addVehicleStep()
  const oil = screen.getByRole('group', { name: 'Моторное масло' })
  expect(within(oil).getByText('каждые 10 000 км или 12 мес.')).toBeInTheDocument()
  const brake = screen.getByRole('group', { name: 'Тормозная жидкость' })
  expect(within(brake).getByText('каждые 24 мес.')).toBeInTheDocument()
})

// ClientID сборки приходит из .env.local и попадает в yandexAuth при импорте — тесты «Подключить» задают его сами.
test('«Подключить Яндекс.Диск» без ClientID ведёт в настройки синхронизации', async () => {
  vi.stubEnv('VITE_YANDEX_CLIENT_ID', '')
  vi.spyOn(yandexAuth, 'getClientId').mockReturnValue(null)
  const loginUrl = vi.spyOn(yandexAuth, 'loginUrl')
  const router = renderAt('/onboarding')
  await addVehicleStep()
  await userEvent.click(screen.getByRole('button', { name: 'Дальше' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Подключить Яндекс.Диск' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/settings/sync'))
  expect(loginUrl).not.toHaveBeenCalled()
})

test('«Подключить Яндекс.Диск» с ClientID уходит на вход в Яндекс через goToUrl', async () => {
  vi.spyOn(yandexAuth, 'getClientId').mockReturnValue('client-id')
  const loginUrl = vi.spyOn(yandexAuth, 'loginUrl').mockReturnValue('https://oauth.yandex.ru/authorize?x=1')
  const router = renderAt('/onboarding')
  await addVehicleStep()
  await userEvent.click(screen.getByRole('button', { name: 'Дальше' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Подключить Яндекс.Диск' }))
  await waitFor(() => expect(goToUrl).toHaveBeenCalledWith('https://oauth.yandex.ru/authorize?x=1'))
  expect(loginUrl).toHaveBeenCalledOnce()
  expect(router.state.location.pathname).toBe('/onboarding')
})

// DEF-04: «Назад» на первом шаге стирал форму машины и её фото; «Дальше» был с дискетой.
test('шаг 1: без «Назад», у «Дальше» нет дискеты', async () => {
  renderAt('/onboarding')
  await screen.findByRole('heading', { name: 'Добавьте машину' })
  expect(screen.queryByRole('button', { name: 'Назад' })).not.toBeInTheDocument()
  const next = screen.getByRole('button', { name: 'Дальше' })
  expect(next.querySelector('.tabler-icon-device-floppy')).toBeNull()
})

test('шаг 2 «Назад» — снова шаг 1 с введённым; повторное «Дальше» правит ту же машину', async () => {
  renderAt('/onboarding')
  await addVehicleStep()
  const [created] = await db.vehicles.toArray()
  await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
  await screen.findByRole('heading', { name: 'Добавьте машину' })
  expect(screen.getByLabelText('Марка')).toHaveValue('Skoda')
  expect(screen.getByLabelText('Модель')).toHaveValue('Octavia')
  await userEvent.type(screen.getByLabelText('Госномер'), 'а123вс77')
  await userEvent.click(screen.getByRole('button', { name: 'Дальше' }))
  await screen.findByRole('heading', { name: 'Что напоминать' })
  const vehicles = await db.vehicles.toArray()
  expect(vehicles).toHaveLength(1)
  expect(vehicles[0]).toMatchObject({ id: created!.id, make: 'Skoda', plate: 'А123ВС77' })
})

test('шаг 3 «Назад» — снова шаг 2 с тем же выбором; повторное «Дальше» не плодит напоминания', async () => {
  renderAt('/onboarding')
  await addVehicleStep()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Свечи зажигания' }))
  await userEvent.type(screen.getByLabelText('Моторное масло: когда делали последний раз'), '140000')
  await userEvent.click(screen.getByRole('button', { name: 'Дальше' }))
  await screen.findByRole('heading', { name: 'Синхронизация' })
  expect(await db.reminderRules.count()).toBe(7)

  await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
  await screen.findByRole('heading', { name: 'Что напоминать' })
  expect(screen.getByRole('checkbox', { name: 'Свечи зажигания' })).not.toBeChecked()
  expect(screen.getByLabelText('Моторное масло: когда делали последний раз')).toHaveValue(`140${NBSP}000`)
  // Передумал: свечи тоже напоминать, а воздушный фильтр — нет.
  await userEvent.click(screen.getByRole('checkbox', { name: 'Свечи зажигания' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Воздушный фильтр' }))
  await userEvent.click(screen.getByRole('button', { name: 'Дальше' }))
  await screen.findByRole('heading', { name: 'Синхронизация' })

  const rules = (await db.reminderRules.toArray()).filter((r) => !r.deleted)
  expect(rules).toHaveLength(7)
  expect(rules.some((r) => r.itemId === CATALOG_ID.sparkPlugs)).toBe(true)
  expect(rules.some((r) => r.itemId === CATALOG_ID.airFilter)).toBe(false)
  expect(rules.filter((r) => r.itemId === CATALOG_ID.engineOil)).toHaveLength(1)
  expect(rules.find((r) => r.itemId === CATALOG_ID.engineOil)!.baseline).toEqual({ odometer: 140000 })
})

// DEF-01: на новом устройстве данные восстанавливают до того, как заведена машина.
test('шаг 1: «Уже есть данные на Яндекс.Диске» ведёт в синхронизацию, машина не создаётся', async () => {
  const router = renderAt('/onboarding')
  await userEvent.click(await screen.findByRole('button', { name: 'Уже есть данные на Яндекс.Диске' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/settings/sync'))
  expect(await db.vehicles.count()).toBe(0)
})

test('шаг 1: «Загрузить копию» ведёт к загрузке копии, машина не создаётся', async () => {
  const router = renderAt('/onboarding')
  await userEvent.click(await screen.findByRole('button', { name: 'Загрузить копию' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/settings/data'))
  expect(await db.vehicles.count()).toBe(0)
})
