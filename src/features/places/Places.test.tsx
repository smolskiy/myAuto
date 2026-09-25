import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { ToastProvider } from '../../ui'
import MasterPage from './MasterPage'
import PlacePage from './PlacePage'
import PlacesPage from './PlacesPage'

const NBSP = '\u00a0'

beforeEach(async () => {
  await db.open()
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

/** Быстрый ввод: вставка вместо посимвольного набора (длинные строки в jsdom набираются секундами). */
async function fill(field: HTMLElement, text: string) {
  await userEvent.click(field)
  await userEvent.paste(text)
}

function renderAt(path: string, history: string[] = []) {
  const router = createMemoryRouter(
    [
      { path: '/places', element: <PlacesPage /> },
      { path: '/places/new', element: <PlacePage /> },
      { path: '/places/:id', element: <PlacePage /> },
      { path: '/masters/new', element: <MasterPage /> },
      { path: '/masters/:id', element: <MasterPage /> },
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

const addVehicle = (name: string, order: number) =>
  repos.vehicles.create({ name, make: 'Skoda', model: name, archived: false, fluids: [], order })

async function twoCarsAtOnePlace() {
  const octavia = await addVehicle('Октавия', 0)
  const rapid = await addVehicle('Рапид', 1)
  const place = await repos.places.create({
    kind: 'service',
    name: 'Автосервис на Ленина',
    address: 'Москва, ул. Ленина, 5',
    phone: '+7 (495) 123-45-67',
    rating: 4,
  })
  const service = await repos.records.create({
    vehicleId: octavia.id,
    kind: 'service',
    date: '2026-08-10',
    odometer: 148000,
    total: 1_000_000,
    placeId: place.id,
    title: 'ТО-7',
    serviceType: 'maintenance',
    diy: false,
    works: [],
    parts: [],
  })
  await repos.records.create({
    vehicleId: rapid.id,
    kind: 'expense',
    date: '2026-09-01',
    total: 250_000,
    placeId: place.id,
    category: 'wash',
    title: 'Химчистка салона',
  })
  return { octavia, rapid, place, service }
}

describe('список мест и мастеров', () => {
  test('места группами по виду: визиты и сумма по всем машинам', async () => {
    const { place } = await twoCarsAtOnePlace()
    await repos.places.create({ kind: 'fuel', name: 'Лукойл' })
    renderAt('/places')

    const services = await screen.findByRole('list', { name: 'СТО' })
    const row = within(services).getByRole('button', { name: new RegExp(place.name) })
    await waitFor(() => expect(row.textContent).toContain(`2${NBSP}визита · 12${NBSP}500${NBSP}₽`))
    expect(within(row).getByRole('img', { name: 'Оценка: 4 из 5' })).toBeInTheDocument()
    const stations = screen.getByRole('list', { name: 'АЗС' })
    expect(within(stations).getByRole('button', { name: /Лукойл/ })).toHaveTextContent('Нет визитов')
  })

  test('мастера: имя, место и специализация; «Добавить мастера»', async () => {
    const place = await repos.places.create({ kind: 'service', name: 'Автосервис' })
    await repos.masters.create({ name: 'Сергей', placeId: place.id, specialization: 'Моторист' })
    const router = renderAt('/places')

    await userEvent.click(await screen.findByRole('radio', { name: 'Мастера' }))
    const row = await screen.findByRole('button', { name: /Сергей/ })
    expect(row).toHaveTextContent('Автосервис · Моторист')
    await userEvent.click(screen.getByRole('button', { name: 'Добавить мастера' }))
    expect(router.state.location.pathname).toBe('/masters/new')
  })
})

describe('карточка места', () => {
  test('статистика по двум машинам и визиты с названием машины', async () => {
    const { place } = await twoCarsAtOnePlace()
    renderAt(`/places/${place.id}`)

    const stats = await screen.findByRole('region', { name: 'Статистика' })
    await waitFor(() => expect(stats).toHaveTextContent('Визиты2'))
    expect(stats.textContent).toContain(`Всего потрачено12${NBSP}500${NBSP}₽`)
    expect(stats.textContent).toContain(`Средний чек6${NBSP}250${NBSP}₽`)
    expect(stats).toHaveTextContent('Последний визит01.09.2026')

    const visits = screen.getByRole('list', { name: 'Визиты' })
    const rows = within(visits).getAllByRole('button')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Химчистка салона')
    expect(rows[0]).toHaveTextContent('Рапид')
    expect(rows[1]).toHaveTextContent('ТО-7')
    expect(rows[1]).toHaveTextContent('Октавия')
  })

  test('телефон — ссылка tel:, адрес — ссылка на Яндекс.Карты', async () => {
    const { place } = await twoCarsAtOnePlace()
    renderAt(`/places/${place.id}`)

    expect(await screen.findByRole('link', { name: 'Позвонить' })).toHaveAttribute('href', 'tel:+74951234567')
    expect(screen.getByRole('link', { name: 'Открыть на карте' })).toHaveAttribute(
      'href',
      `https://yandex.ru/maps/?text=${encodeURIComponent('Москва, ул. Ленина, 5')}`,
    )
  })

  test('своя ссылка места заменяет Яндекс.Карты', async () => {
    const place = await repos.places.create({
      kind: 'service',
      name: 'Дилер',
      address: 'Москва, МКАД 41 км',
      url: 'https://dealer.example/contacts',
    })
    renderAt(`/places/${place.id}`)
    expect(await screen.findByRole('link', { name: 'Открыть на карте' })).toHaveAttribute(
      'href',
      'https://dealer.example/contacts',
    )
  })

  test('мастера места: только этого места', async () => {
    const a = await repos.places.create({ kind: 'service', name: 'Автосервис' })
    const b = await repos.places.create({ kind: 'service', name: 'Дилер' })
    await repos.masters.create({ name: 'Сергей', placeId: a.id })
    await repos.masters.create({ name: 'Андрей', placeId: b.id })
    const router = renderAt(`/places/${a.id}`)

    const masters = await screen.findByRole('list', { name: 'Мастера' })
    await waitFor(() => expect(within(masters).getByText('Сергей')).toBeInTheDocument())
    expect(within(masters).queryByText('Андрей')).not.toBeInTheDocument()

    await userEvent.click(within(masters).getByRole('button', { name: 'Добавить мастера' }))
    expect(router.state.location.pathname).toBe('/masters/new')
    expect(router.state.location.search).toBe(`?placeId=${a.id}`)
  })

  test('новое место без названия — «Добавьте название», место не создаётся', async () => {
    renderAt('/places/new', ['/places'])
    await userEvent.click(await screen.findByRole('button', { name: 'Сохранить' }))
    const name = screen.getByRole('textbox', { name: 'Название' })
    await waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'))
    expect(name).toHaveAccessibleDescription('Добавьте название')
    expect(await repos.places.list()).toHaveLength(0)
  })

  test('новое место сохраняется со всеми полями', async () => {
    const router = renderAt('/places/new', ['/places'])
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Вид' }), 'Шиномонтаж')
    await fill(screen.getByRole('textbox', { name: 'Название' }), 'Колесо')
    await fill(screen.getByRole('textbox', { name: 'Адрес' }), 'Химки, Ленинградская, 1')
    await fill(screen.getByRole('textbox', { name: 'Телефон' }), '+7 900 000-00-00')
    await userEvent.click(screen.getByRole('radio', { name: '5 из 5' }))
    await fill(screen.getByRole('textbox', { name: 'Заметка' }), 'Хранят шины')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/places'))
    const [saved] = await repos.places.list()
    expect(saved).toMatchObject({
      kind: 'tire',
      name: 'Колесо',
      address: 'Химки, Ленинградская, 1',
      phone: '+7 900 000-00-00',
      rating: 5,
      note: 'Хранят шины',
    })
  })

  test('правка места сохраняет изменения', async () => {
    const place = await repos.places.create({ kind: 'service', name: 'Автосервис' })
    renderAt(`/places/${place.id}`, ['/places'])
    const name = await screen.findByRole('textbox', { name: 'Название' })
    await waitFor(() => expect(name).toHaveValue('Автосервис'))
    await userEvent.clear(name)
    await fill(name, 'Автосервис на Ленина')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => expect((await repos.places.get(place.id))?.name).toBe('Автосервис на Ленина'))
  })

  test('удаление места не удаляет записи; «Отменить» возвращает место', async () => {
    const { place, service } = await twoCarsAtOnePlace()
    const router = renderAt(`/places/${place.id}`, ['/places'])

    await userEvent.click(await screen.findByRole('button', { name: 'Удалить место' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/places'))
    expect(await repos.places.get(place.id)).toBeUndefined()
    expect(screen.getByText('Место удалено')).toBeInTheDocument()

    const records = await repos.records.list()
    expect(records).toHaveLength(2)
    expect(records.find((r) => r.id === service.id)?.placeId).toBe(place.id)

    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }))
    await waitFor(async () => expect(await repos.places.get(place.id)).toBeDefined())
  })
})

describe('карточка мастера', () => {
  test('статистика и визиты по мастеру у записи и у строки работ', async () => {
    const octavia = await addVehicle('Октавия', 0)
    const rapid = await addVehicle('Рапид', 1)
    const place = await repos.places.create({ kind: 'service', name: 'Автосервис' })
    const master = await repos.masters.create({ name: 'Сергей', placeId: place.id, phone: '8 916 111 22 33' })
    await repos.records.create({
      vehicleId: octavia.id,
      kind: 'service',
      date: '2026-05-01',
      total: 900_000,
      title: 'Замена сцепления',
      serviceType: 'repair',
      masterId: master.id,
      diy: false,
      works: [],
      parts: [],
    })
    await repos.records.create({
      vehicleId: rapid.id,
      kind: 'service',
      date: '2026-06-01',
      total: 500_000,
      title: 'ТО-3',
      serviceType: 'maintenance',
      diy: false,
      works: [
        { id: 'w1', name: 'Диагностика подвески', price: 150_000, masterId: master.id },
        { id: 'w2', name: 'Замена масла', price: 100_000 },
      ],
      parts: [],
    })
    renderAt(`/masters/${master.id}`)

    const stats = await screen.findByRole('region', { name: 'Статистика' })
    await waitFor(() => expect(stats).toHaveTextContent('Визиты2'))
    expect(stats.textContent).toContain(`Всего потрачено10${NBSP}500${NBSP}₽`)
    const visits = screen.getByRole('list', { name: 'Визиты' })
    expect(within(visits).getAllByRole('button')).toHaveLength(2)
    expect(visits).toHaveTextContent('Рапид')
    expect(screen.getByRole('link', { name: 'Позвонить' })).toHaveAttribute('href', 'tel:89161112233')
    expect(screen.getByRole('combobox', { name: 'Место' })).toHaveValue('Автосервис')
  })

  test('новый мастер без имени — «Добавьте имя»; с местом из ссылки сохраняется', async () => {
    const place = await repos.places.create({ kind: 'service', name: 'Автосервис' })
    const router = renderAt(`/masters/new?placeId=${place.id}`, ['/places'])

    await userEvent.click(await screen.findByRole('button', { name: 'Сохранить' }))
    const name = screen.getByRole('textbox', { name: 'Имя' })
    await waitFor(() => expect(name).toHaveAccessibleDescription('Добавьте имя'))

    await userEvent.type(name, 'Павел')
    await fill(screen.getByRole('textbox', { name: 'Специализация' }), 'Электрик')
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Место' })).toHaveValue('Автосервис'))
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/places'))
    expect(await repos.masters.list()).toEqual([
      expect.objectContaining({ name: 'Павел', placeId: place.id, specialization: 'Электрик' }),
    ])
  })

  test('удаление мастера — с «Отменить»', async () => {
    const master = await repos.masters.create({ name: 'Сергей' })
    renderAt(`/masters/${master.id}`, ['/places'])
    await userEvent.click(await screen.findByRole('button', { name: 'Удалить мастера' }))
    await waitFor(async () => expect(await repos.masters.get(master.id)).toBeUndefined())
    expect(await screen.findByText('Мастер удалён')).toBeInTheDocument()
  })
})
