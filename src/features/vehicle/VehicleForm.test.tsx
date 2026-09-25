import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { META_KEYS, getMeta } from '../../db/meta'
import { repos } from '../../db/repos'
import type { Vehicle } from '../../domain/types'
import { renderAt, vehicle } from '../records/testUtils'

const nhtsa = vi.hoisted(() => ({ fetchNhtsa: vi.fn() }))
vi.mock('../../domain/vin/nhtsa', () => nhtsa)

vi.setConfig({ testTimeout: 15_000 })

beforeAll(async () => {
  await import('./VehicleFormPage')
})

const others = async () => (await db.vehicles.toArray()).filter((v) => v.id !== vehicle.id)

test('VIN XTA210990Y2765432: «Заполнить» ставит марку и год, введённую модель не трогает', async () => {
  renderAt('/vehicle/new')
  await userEvent.type(await screen.findByLabelText('Модель'), '2109')
  await userEvent.type(screen.getByLabelText('VIN'), 'xta210990y2765432')
  expect(screen.getByLabelText('VIN')).toHaveValue('XTA210990Y2765432')
  expect(await screen.findByText('Lada · Россия · 2000')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Заполнить' }))
  expect(screen.getByLabelText('Марка')).toHaveValue('Lada')
  expect(screen.getByLabelText('Год')).toHaveValue('2000')
  expect(screen.getByLabelText('Модель')).toHaveValue('2109')
})

test('VIN с буквой O — предупреждение у поля, заполнять нечего, сохранить можно', async () => {
  renderAt('/vehicle/new')
  await userEvent.type(await screen.findByLabelText('Марка'), 'Toyota')
  await userEvent.type(screen.getByLabelText('Модель'), 'Mark II')
  await userEvent.type(screen.getByLabelText('VIN'), 'XTA2109O0Y2765432')
  expect(await screen.findByText('В VIN не бывает букв I, O, Q')).toBeInTheDocument()
  expect(screen.getByLabelText('VIN')).not.toHaveAttribute('aria-invalid')
  expect(screen.queryByRole('button', { name: 'Заполнить' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Уточнить онлайн' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(async () => expect(await others()).toHaveLength(1))
  expect((await others())[0]).toMatchObject({ vin: 'XTA2109O0Y2765432', make: 'Toyota' })
})

test('номер рамы (не 17 знаков) сохраняется с предупреждением', async () => {
  renderAt('/vehicle/new')
  await userEvent.type(await screen.findByLabelText('Марка'), 'Toyota')
  await userEvent.type(screen.getByLabelText('Модель'), 'Mark II')
  await userEvent.type(screen.getByLabelText('VIN'), 'JZX110-6012345')
  await userEvent.tab()
  expect(await screen.findByText('VIN должен содержать 17 символов')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(async () => expect(await others()).toHaveLength(1))
  expect((await others())[0]!.vin).toBe('JZX1106012345')
})

test('«Уточнить онлайн» без ответа — «Онлайн ничего не нашлось»', async () => {
  nhtsa.fetchNhtsa.mockResolvedValueOnce(null)
  renderAt('/vehicle/new')
  await userEvent.type(await screen.findByLabelText('VIN'), 'XTA210990Y2765432')
  await userEvent.click(screen.getByRole('button', { name: 'Уточнить онлайн' }))
  const none = await screen.findByText('Онлайн ничего не нашлось')
  expect(none.closest('[aria-live="polite"]')).not.toBeNull()
  expect(nhtsa.fetchNhtsa).toHaveBeenCalledWith('XTA210990Y2765432')
})

test('«Уточнить онлайн» с ответом заполняет пустые поля', async () => {
  nhtsa.fetchNhtsa.mockResolvedValueOnce({
    make: 'Honda',
    model: 'Accord',
    year: 2003,
    engine: { displacementCc: 2400, fuel: 'petrol' },
    transmission: 'at',
  })
  renderAt('/vehicle/new')
  await userEvent.type(await screen.findByLabelText('VIN'), '1HGCM82633A004352')
  await userEvent.click(screen.getByRole('button', { name: 'Уточнить онлайн' }))
  const found = await screen.findByText(/Honda · Accord · 2003/)
  await userEvent.click(within(found.closest('div')!).getByRole('button', { name: 'Заполнить' }))
  expect(screen.getByLabelText('Модель')).toHaveValue('Accord')
  expect(screen.getByLabelText('Коробка передач')).toHaveValue('at')
})

test('новая машина сохраняется следующей по порядку и становится активной', async () => {
  const router = renderAt('/vehicle/new')
  await userEvent.type(await screen.findByLabelText('Марка'), 'Skoda')
  await userEvent.type(screen.getByLabelText('Модель'), 'Rapid')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(async () => expect(await others()).toHaveLength(1))
  const [v] = await others()
  expect(v).toMatchObject({
    name: 'Skoda Rapid',
    make: 'Skoda',
    model: 'Rapid',
    archived: false,
    order: 1,
    fluids: [],
  })
  expect(await getMeta(db, META_KEYS.activeVehicleId, null)).toBe(v!.id)
  await waitFor(() => expect(router.state.location.pathname).toBe(`/vehicle/${v!.id}`))
})

test('без марки и модели — ошибки у полей', async () => {
  renderAt('/vehicle/new')
  await userEvent.click(await screen.findByRole('button', { name: 'Сохранить' }))
  expect(await screen.findByText('Укажите марку')).toBeInTheDocument()
  expect(screen.getByText('Укажите модель')).toBeInTheDocument()
  expect(await others()).toHaveLength(0)
})

test('дата продажи — подсказка про архив и archived: true', async () => {
  renderAt('/vehicle/new')
  await userEvent.type(await screen.findByLabelText('Марка'), 'Lada')
  await userEvent.type(screen.getByLabelText('Модель'), '2109')
  await userEvent.type(screen.getByLabelText('Дата продажи'), '2025-06-01')
  expect(await screen.findByText('Машина уйдёт в архив')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(async () => expect(await others()).toHaveLength(1))
  expect((await others())[0]).toMatchObject({ archived: true, sale: { date: '2025-06-01' } })
})

test('«Добавить жидкость» без спецификации и объёма ничего не добавляет', async () => {
  renderAt('/vehicle/new')
  await userEvent.click(await screen.findByRole('button', { name: 'Добавить жидкость' }))
  const sheet = await screen.findByRole('dialog', { name: 'Жидкость' })
  await userEvent.click(within(sheet).getByRole('button', { name: 'Готово' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Жидкость' })).not.toBeInTheDocument())
  expect(screen.queryByText('Моторное масло')).not.toBeInTheDocument()
})

test('жидкость добавляется в список и сохраняется', async () => {
  renderAt('/vehicle/new')
  await userEvent.type(await screen.findByLabelText('Марка'), 'Skoda')
  await userEvent.type(screen.getByLabelText('Модель'), 'Rapid')
  await userEvent.click(screen.getByRole('button', { name: 'Добавить жидкость' }))
  const sheet = await screen.findByRole('dialog', { name: 'Жидкость' })
  await userEvent.selectOptions(within(sheet).getByLabelText('Вид'), 'engineOil')
  await userEvent.type(within(sheet).getByLabelText('Спецификация'), 'VW 504.00 5W-30')
  await userEvent.type(within(sheet).getByLabelText('Объём'), '4,3')
  await userEvent.click(within(sheet).getByRole('button', { name: 'Готово' }))
  expect(await screen.findByText('Моторное масло')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(async () => expect(await others()).toHaveLength(1))
  expect((await others())[0]!.fluids).toEqual([{ kind: 'engineOil', spec: 'VW 504.00 5W-30', volumeL: 4.3 }])
})

test('правка машины показывает её данные и сохраняет изменения', async () => {
  const v: Vehicle = await repos.vehicles.update(vehicle.id, {
    year: 2019,
    vin: 'TMBJG7NE0K0123456',
    engine: { fuel: 'petrol', displacementCc: 1395, powerHp: 150 },
    purchase: { date: '2021-05-10', odometer: 45000, price: 150000000 },
  })
  renderAt(`/vehicle/${v.id}/edit`)
  expect(await screen.findByLabelText('Название')).toHaveValue('Октавия')
  expect(screen.getByLabelText('Год')).toHaveValue('2019')
  expect(screen.getByLabelText('Мощность')).toHaveValue('150')
  await userEvent.clear(screen.getByLabelText('Госномер'))
  await userEvent.type(screen.getByLabelText('Госномер'), 'а123вс77')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(async () => expect((await repos.vehicles.get(v.id))?.plate).toBe('А123ВС77'))
  expect(await repos.vehicles.get(v.id)).toMatchObject({
    order: 0,
    archived: false,
    engine: { fuel: 'petrol', displacementCc: 1395, powerHp: 150 },
    purchase: { date: '2021-05-10', odometer: 45000, price: 150000000 },
  })
})

test('правка несуществующей машины — «Машина не найдена»', async () => {
  renderAt('/vehicle/nope/edit')
  expect(await screen.findByText('Машина не найдена')).toBeInTheDocument()
})

test('чертёж на главной: «Автоматически» показывает подобранный, другой выбор сохраняется', async () => {
  await repos.vehicles.update(vehicle.id, { make: 'Skoda', model: 'Octavia', year: 2011 })
  renderAt(`/vehicle/${vehicle.id}/edit`)
  const group = await screen.findByRole('radiogroup', { name: 'Картинка на главной' })
  const auto = within(group).getByRole('radio', { name: /Автоматически/ })
  expect(auto).toBeChecked()
  expect(auto.closest('label')).toHaveTextContent('Skoda Octavia A5')
  await userEvent.click(within(group).getByRole('radio', { name: 'BMW X5' }))
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(async () => expect((await repos.vehicles.get(vehicle.id))?.schematic).toBe('x5-f15'))
})

test('«Без картинки» сохраняется как none', async () => {
  await repos.vehicles.update(vehicle.id, { schematic: 'lanos' })
  renderAt(`/vehicle/${vehicle.id}/edit`)
  const group = await screen.findByRole('radiogroup', { name: 'Картинка на главной' })
  expect(within(group).getByRole('radio', { name: 'Daewoo Lanos' })).toBeChecked()
  await userEvent.click(within(group).getByRole('radio', { name: 'Без картинки' }))
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(async () => expect((await repos.vehicles.get(vehicle.id))?.schematic).toBe('none'))
})

test('снова «Автоматически» — выбор снимается', async () => {
  await repos.vehicles.update(vehicle.id, { schematic: 'none' })
  renderAt(`/vehicle/${vehicle.id}/edit`)
  const group = await screen.findByRole('radiogroup', { name: 'Картинка на главной' })
  await userEvent.click(within(group).getByRole('radio', { name: /Автоматически/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(async () => expect((await repos.vehicles.get(vehicle.id))?.schematic).toBeUndefined())
})
