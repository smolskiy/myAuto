import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { CATALOG_ID } from '../../domain/catalog'
import type { Attachment, ID, OwnerType, PartLine, ServiceRecord, WorkLine } from '../../domain/types'
import { linesTotal } from './form/serviceTotals'
import { renderAt, vehicle } from './testUtils'

// Хранилище вложений без файлов: строки — в настоящей базе (fake-indexeddb).
const store = vi.hoisted(() => ({
  addFile: vi.fn(),
  getThumbUrl: vi.fn(async () => null),
  getOriginalUrl: vi.fn(async () => null),
  remove: vi.fn(),
  pendingCount: vi.fn(async () => 0),
}))
vi.mock('../../sync/index', () => ({
  attachmentStore: store,
  syncEngine: { subscribe: () => () => {}, getStatus: () => ({ state: 'off', pendingUploads: 0 }) },
  yandexAuth: { subscribe: () => () => {}, isConnected: () => false, getLoginError: () => null },
}))

// Длинные сценарии ввода (шторки, по символу в каждое поле) под нагрузкой не укладываются в 5 с.
vi.setConfig({ testTimeout: 20_000 })

beforeEach(() => {
  store.addFile.mockImplementation((owner: { ownerType: OwnerType; ownerId: ID }, file: File) =>
    repos.attachments.create({ ...owner, kind: 'photo', name: file.name, mime: 'image/jpeg', size: 1000 }),
  )
  store.remove.mockImplementation((att: Attachment) => repos.attachments.remove(att.id))
})

const work = (name: string, price?: number): WorkLine => ({ id: crypto.randomUUID(), name, price })
const part = (p: Partial<PartLine> & { name: string }): PartLine => ({
  id: crypto.randomUUID(),
  qty: 1,
  unit: 'pcs',
  ownPart: false,
  ...p,
})

const pastService = (s: Partial<ServiceRecord> = {}) =>
  repos.records.create({
    vehicleId: vehicle.id,
    kind: 'service',
    date: '2026-03-01',
    odometer: 140000,
    total: 0,
    title: 'ТО-1',
    serviceType: 'maintenance',
    diy: false,
    works: [],
    parts: [],
    ...s,
  })

const savedServices = async () =>
  (await db.records.toArray()).filter(
    (r): r is ServiceRecord => r.kind === 'service' && r.title !== 'ТО-1' && r.title !== 'Прошлое',
  )

async function typeTitle(title: string) {
  await userEvent.type(await screen.findByRole('combobox', { name: 'Название' }), title)
}

async function addWork(name: string, price: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Добавить работу' }))
  const sheet = await screen.findByRole('dialog', { name: 'Работа' })
  await userEvent.type(within(sheet).getByLabelText('Название'), name)
  await userEvent.type(within(sheet).getByLabelText('Цена'), price)
  await userEvent.click(within(sheet).getByRole('button', { name: 'Готово' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Работа' })).not.toBeInTheDocument())
}

async function openPart() {
  await userEvent.click(screen.getByRole('button', { name: 'Добавить запчасть' }))
  return screen.findByRole('dialog', { name: 'Запчасть' })
}

async function pickNode(sheet: HTMLElement, query: string, name: string) {
  await userEvent.type(within(sheet).getByRole('combobox', { name: 'Узел' }), query)
  await userEvent.click(await within(sheet).findByRole('option', { name: new RegExp(`^${name}`) }))
}

async function closeSheet(sheet: HTMLElement) {
  await userEvent.click(within(sheet).getByRole('button', { name: 'Готово' }))
  await waitFor(() => expect(sheet).not.toBeInTheDocument())
}

describe('linesTotal', () => {
  test('сумма строк с тем же округлением, что lineTotal', () => {
    expect(
      linesTotal(
        [work('Замена масла', 150000), work('Диагностика')],
        [
          part({ name: 'Масло', qty: 4.2, unit: 'l', unitPrice: 99999 }),
          part({ name: 'Фильтр', unitPrice: 65000 }),
        ],
      ),
    ).toBe(150000 + Math.round(4.2 * 99999) + 65000)
  })
})

test('ТО с двумя запчастями и работой: итог — сумма строк, строки сохраняются', async () => {
  const router = renderAt('/record/new/service')
  await typeTitle('ТО-7')
  await addWork('Замена масла', '1500')

  let sheet = await openPart()
  await pickNode(sheet, 'Масляный', 'Масляный фильтр')
  expect(within(sheet).getByLabelText('Название')).toHaveValue('Масляный фильтр')
  await userEvent.type(within(sheet).getByRole('combobox', { name: 'Бренд' }), 'Mann-Filter')
  await userEvent.type(within(sheet).getByLabelText('Артикул'), 'W 712/95')
  await userEvent.type(within(sheet).getByLabelText('Цена за шт'), '650')
  await closeSheet(sheet)

  sheet = await openPart()
  await userEvent.type(within(sheet).getByLabelText('Название'), 'Масло 5W-30')
  await userEvent.selectOptions(within(sheet).getByLabelText('Единица'), 'l')
  await userEvent.clear(within(sheet).getByLabelText('Количество'))
  await userEvent.type(within(sheet).getByLabelText('Количество'), '4')
  await userEvent.type(within(sheet).getByLabelText('Цена за л'), '900')
  await closeSheet(sheet)

  expect(screen.getByLabelText('Итого')).toHaveValue('5\u00a0750')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\/[0-9a-f-]{36}$/))

  const [r] = await savedServices()
  expect(r).toMatchObject({
    kind: 'service',
    title: 'ТО-7',
    serviceType: 'maintenance',
    total: 575000,
    works: [{ name: 'Замена масла', price: 150000 }],
    parts: [
      {
        itemId: CATALOG_ID.oilFilter,
        name: 'Масляный фильтр',
        brand: 'Mann-Filter',
        partNumber: 'W 712/95',
        qty: 1,
        unit: 'pcs',
        unitPrice: 65000,
        ownPart: false,
      },
      { name: 'Масло 5W-30', qty: 4, unit: 'l', unitPrice: 90000 },
    ],
  })
})

test('подсказка на строке, потом повторное открытие строки: шторка показывает заполненное и сохраняет его', async () => {
  await pastService({
    parts: [
      part({
        itemId: CATALOG_ID.oilFilter,
        name: 'Фильтр масляный',
        brand: 'Mann-Filter',
        partNumber: 'W 712/95',
        unitPrice: 65000,
      }),
    ],
  })
  const router = renderAt('/record/new/service')
  await typeTitle('ТО-2')
  let sheet = await openPart()
  await pickNode(sheet, 'Масляный', 'Масляный фильтр')
  await closeSheet(sheet)
  await userEvent.click(
    await screen.findByRole('button', { name: 'В прошлый раз: Mann-Filter W 712/95, 650\u00a0₽' }),
  )
  await userEvent.click(screen.getByRole('button', { name: /^Масляный фильтр/ }))
  sheet = await screen.findByRole('dialog', { name: 'Запчасть' })
  expect(within(sheet).getByRole('combobox', { name: 'Бренд' })).toHaveValue('Mann-Filter')
  expect(within(sheet).getByLabelText('Артикул')).toHaveValue('W 712/95')
  expect(within(sheet).getByLabelText('Цена за шт')).toHaveValue('650')
  await closeSheet(sheet)
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\/[0-9a-f-]{36}$/))
  expect((await savedServices())[0]!.parts[0]).toMatchObject({
    itemId: CATALOG_ID.oilFilter,
    brand: 'Mann-Filter',
    partNumber: 'W 712/95',
    unitPrice: 65000,
  })
})

test('подсказка «в прошлый раз» для узла с историей заполняет бренд, артикул и цену', async () => {
  await pastService({
    parts: [
      part({
        itemId: CATALOG_ID.oilFilter,
        name: 'Фильтр масляный',
        brand: 'Mann-Filter',
        partNumber: 'W 712/95',
        unitPrice: 65000,
      }),
    ],
  })
  renderAt('/record/new/service')
  await screen.findByRole('combobox', { name: 'Название' })
  const sheet = await openPart()
  await pickNode(sheet, 'Масляный', 'Масляный фильтр')
  await userEvent.click(
    await within(sheet).findByRole('button', { name: 'В прошлый раз: Mann-Filter W 712/95, 650\u00a0₽' }),
  )
  expect(within(sheet).getByRole('combobox', { name: 'Бренд' })).toHaveValue('Mann-Filter')
  expect(within(sheet).getByLabelText('Артикул')).toHaveValue('W 712/95')
  expect(within(sheet).getByLabelText('Цена за шт')).toHaveValue('650')
})

test('ручной итог не пересчитывается, «Считать по строкам» возвращает авторасчёт', async () => {
  const router = renderAt('/record/new/service')
  await typeTitle('Ремонт подвески')
  await addWork('Стойки стабилизатора', '1500')
  expect(screen.getByLabelText('Итого')).toHaveValue('1\u00a0500')

  await userEvent.clear(screen.getByLabelText('Итого'))
  await userEvent.type(screen.getByLabelText('Итого'), '2000')
  expect(await screen.findByText('Итог по строкам: 1 500 ₽')).toBeInTheDocument()

  await addWork('Развал-схождение', '700')
  expect(screen.getByLabelText('Итого')).toHaveValue('2\u00a0000')

  await userEvent.click(screen.getByRole('button', { name: 'Считать по строкам' }))
  expect(screen.getByLabelText('Итого')).toHaveValue('2\u00a0200')
  expect(screen.queryByRole('button', { name: 'Считать по строкам' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\//))
  expect((await savedServices())[0]?.total).toBe(220000)
})

test('ручной итог сохраняется как введён', async () => {
  const router = renderAt('/record/new/service')
  await typeTitle('Кузовной ремонт')
  await userEvent.type(screen.getByLabelText('Итого'), '12000')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\//))
  expect((await savedServices())[0]?.total).toBe(1200000)
})

test('«Повторить прошлое ТО» копирует строки с новыми id и ценами', async () => {
  const past = await pastService({
    works: [{ id: 'w1', name: 'Замена масла', price: 150000 }],
    parts: [
      { id: 'p1', name: 'Масло 5W-30', qty: 4, unit: 'l', unitPrice: 90000, ownPart: true, brand: 'Castrol' },
    ],
  })
  const router = renderAt('/record/new/service')
  await typeTitle('ТО-2')
  await userEvent.click(screen.getByRole('button', { name: 'Повторить прошлое ТО' }))
  expect(screen.getByText('Замена масла')).toBeInTheDocument()
  expect(screen.getByText('Масло 5W-30')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\//))
  const [r] = (await db.records.toArray()).filter(
    (x): x is ServiceRecord => x.kind === 'service' && x.id !== past.id,
  )
  expect(r!.works).toEqual([{ id: expect.any(String), name: 'Замена масла', price: 150000 }])
  expect(r!.works[0]!.id).not.toBe('w1')
  expect(r!.parts[0]).toMatchObject({
    name: 'Масло 5W-30',
    qty: 4,
    unit: 'l',
    unitPrice: 90000,
    brand: 'Castrol',
  })
  expect(r!.parts[0]!.id).not.toBe('p1')
  expect(r!.total).toBe(150000 + 360000)
})

test('«Повторить» берёт запись с тем же названием, иначе последнюю того же типа', async () => {
  await pastService({ title: 'Прошлое', date: '2026-01-10', works: [{ id: 'a', name: 'Мойка двигателя' }] })
  await pastService({ title: 'ТО-1', date: '2026-02-10', works: [{ id: 'b', name: 'Замена свечей' }] })
  renderAt('/record/new/service')
  await typeTitle('Прошлое')
  await userEvent.click(screen.getByRole('button', { name: 'Повторить прошлое ТО' }))
  expect(screen.getByText('Мойка двигателя')).toBeInTheDocument()
  expect(screen.queryByText('Замена свечей')).not.toBeInTheDocument()
})

test('отмена формы после добавления фото выбрасывает вложения черновика', async () => {
  const router = renderAt('/record/new/service')
  await screen.findByRole('combobox', { name: 'Название' })
  await userEvent.upload(
    screen.getByLabelText('Добавить фото'),
    new File(['x'], 'заказ-наряд.jpg', { type: 'image/jpeg' }),
  )
  await waitFor(() => expect(store.addFile).toHaveBeenCalled())
  await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
  await waitFor(() =>
    expect(store.remove).toHaveBeenCalledWith(expect.objectContaining({ name: 'заказ-наряд.jpg' })),
  )
  await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  expect(await db.records.count()).toBe(0)
})

test('без названия — «Добавьте название»', async () => {
  renderAt('/record/new/service')
  await screen.findByRole('combobox', { name: 'Название' })
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  expect(await screen.findByText('Добавьте название')).toBeInTheDocument()
  expect(await db.records.count()).toBe(0)
})

test('название подсказывает «ТО-N» и прошлые названия', async () => {
  await pastService({ title: 'ТО-1' })
  await pastService({ title: 'Замена колодок', serviceType: 'repair' })
  renderAt('/record/new/service')
  await userEvent.click(await screen.findByRole('combobox', { name: 'Название' }))
  const names = (await screen.findAllByRole('option')).map((o) => o.textContent)
  expect(names[0]).toBe('ТО-2')
  expect(names).toEqual(expect.arrayContaining(['ТО-1', 'Замена колодок']))
})

test('«ТО-N» продолжает нумерацию прошлых названий, если история введена не с начала', async () => {
  await pastService({ title: 'ТО-6' })
  renderAt('/record/new/service')
  await userEvent.click(await screen.findByRole('combobox', { name: 'Название' }))
  expect((await screen.findAllByRole('option'))[0]).toHaveTextContent('ТО-7')
})

test('смена места снимает мастера', async () => {
  const a = await repos.places.create({ kind: 'service', name: 'Автосервис на Ленина' })
  await repos.places.create({ kind: 'service', name: 'Дилер' })
  await repos.masters.create({ name: 'Сергей', placeId: a.id })
  renderAt('/record/new/service')
  const place = await screen.findByRole('combobox', { name: 'Место' })
  await userEvent.type(place, 'Ленина')
  await userEvent.click(await screen.findByRole('option', { name: 'Автосервис на Ленина' }))
  await userEvent.click(screen.getByRole('combobox', { name: 'Мастер' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Сергей' }))
  expect(screen.getByRole('combobox', { name: 'Мастер' })).toHaveValue('Сергей')

  await userEvent.clear(place)
  await userEvent.type(place, 'Дилер')
  await userEvent.click(await screen.findByRole('option', { name: 'Дилер' }))
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Мастер' })).toHaveValue(''))
})

test('«Делал сам» прячет мастера', async () => {
  renderAt('/record/new/service')
  await screen.findByRole('combobox', { name: 'Мастер' })
  await userEvent.click(screen.getByRole('switch', { name: 'Делал сам' }))
  expect(screen.queryByRole('combobox', { name: 'Мастер' })).not.toBeInTheDocument()
})

test('смена шин с комплектом требует пробег', async () => {
  const set = await repos.tireSets.create({
    vehicleId: vehicle.id,
    season: 'winter',
    brand: 'Nokian',
    model: 'Hakkapeliitta 10',
    count: 4,
    status: 'stored',
  })
  const router = renderAt('/record/new/service')
  await typeTitle('Переобувка')
  await userEvent.selectOptions(screen.getByLabelText('Тип работ'), 'tires')
  await userEvent.selectOptions(screen.getByLabelText('Установлен комплект'), set.id)
  await userEvent.clear(screen.getByLabelText('Пробег'))
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  expect(await screen.findByText('Укажите пробег — без него не посчитать пробег шин')).toBeInTheDocument()

  await userEvent.type(screen.getByLabelText('Пробег'), '150000')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\//))
  expect((await savedServices())[0]).toMatchObject({ odometer: 150000, tireSwap: { mountedSetId: set.id } })
})

describe('смена шин обновляет состояние комплектов', () => {
  const tireSet = (status: 'installed' | 'stored' | 'retired', brand: string, vehicleId = vehicle.id) =>
    repos.tireSets.create({ vehicleId, season: 'winter', brand, count: 4, status })

  test('установленный — «Установлены», прежний установленный и снятый — «На хранении»', async () => {
    const winter = await tireSet('stored', 'Nokian')
    const summer = await tireSet('installed', 'Michelin')
    const spare = await tireSet('installed', 'Cordiant')
    const retired = await tireSet('retired', 'Kama')
    const other = await repos.vehicles.create({
      name: 'Рапид',
      make: 'Skoda',
      model: 'Rapid',
      archived: false,
      fluids: [],
      order: 1,
    })
    const foreign = await tireSet('installed', 'Pirelli', other.id)

    const router = renderAt('/record/new/service')
    await typeTitle('Переобувка')
    await userEvent.selectOptions(screen.getByLabelText('Тип работ'), 'tires')
    await userEvent.selectOptions(screen.getByLabelText('Установлен комплект'), winter.id)
    await userEvent.selectOptions(screen.getByLabelText('Снят комплект'), summer.id)
    await userEvent.type(screen.getByLabelText('Пробег'), '150000')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\//))

    const status = async (id: string) => (await repos.tireSets.get(id))?.status
    expect(await status(winter.id)).toBe('installed')
    expect(await status(summer.id)).toBe('stored')
    expect(await status(spare.id)).toBe('stored')
    expect(await status(retired.id)).toBe('retired')
    expect(await status(foreign.id)).toBe('installed')
  })

  test('без выбранных комплектов состояния не трогаются', async () => {
    const summer = await tireSet('installed', 'Michelin')
    const router = renderAt('/record/new/service')
    await typeTitle('Шиномонтаж')
    await userEvent.selectOptions(screen.getByLabelText('Тип работ'), 'tires')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\//))
    const set = await repos.tireSets.get(summer.id)
    expect(set?.status).toBe('installed')
    expect(set?.updatedAt).toBe(summer.updatedAt)
  })

  /** Последняя переобувка: летние установлены 20.09.2026. */
  async function latestSwap(summerId: string) {
    return pastService({
      title: 'Переобувка',
      serviceType: 'tires',
      date: '2026-09-20',
      odometer: 140000,
      tireSwap: { mountedSetId: summerId },
    })
  }

  async function selectSet(label: string, id: string) {
    const select = await screen.findByLabelText(label)
    await within(select).findByRole('option', { name: /Nokian/ })
    await userEvent.selectOptions(select, id)
  }

  test('смена установленного комплекта в последней переобувке применяется', async () => {
    const winter = await tireSet('stored', 'Nokian')
    const summer = await tireSet('installed', 'Michelin')
    const rec = await latestSwap(summer.id)
    renderAt(`/record/${rec.id}/edit`)
    await selectSet('Установлен комплект', winter.id)
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => expect((await repos.tireSets.get(winter.id))?.status).toBe('installed'))
    expect((await repos.tireSets.get(summer.id))?.status).toBe('stored')
    expect((await repos.records.get(rec.id)) as ServiceRecord).toMatchObject({
      tireSwap: { mountedSetId: winter.id },
    })
  })

  test('переобувка задним числом не трогает текущие состояния', async () => {
    const winter = await tireSet('stored', 'Nokian')
    const summer = await tireSet('installed', 'Michelin')
    await latestSwap(summer.id)
    const router = renderAt('/record/new/service')
    await typeTitle('Переобувка прошлой зимой')
    await userEvent.selectOptions(screen.getByLabelText('Тип работ'), 'tires')
    const date = screen.getByLabelText('Дата')
    await userEvent.clear(date)
    await userEvent.type(date, '2025-11-01')
    await userEvent.clear(screen.getByLabelText('Пробег'))
    await userEvent.type(screen.getByLabelText('Пробег'), '120000')
    await selectSet('Установлен комплект', winter.id)
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\/[0-9a-f-]{36}$/))
    expect((await repos.tireSets.get(winter.id))?.status).toBe('stored')
    expect((await repos.tireSets.get(summer.id))?.status).toBe('installed')
  })

  test('правка только заметки последней переобувки состояния не трогает', async () => {
    // После переобувки состояния поправили вручную (экран «Шины»): зимние — установлены.
    const winter = await tireSet('installed', 'Nokian')
    const summer = await tireSet('stored', 'Michelin')
    const rec = await latestSwap(summer.id)
    renderAt(`/record/${rec.id}/edit`)
    await userEvent.type(await screen.findByLabelText('Заметка'), 'Балансировка')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => expect((await repos.records.get(rec.id))?.note).toBe('Балансировка'))
    expect(await repos.tireSets.get(winter.id)).toMatchObject({
      status: 'installed',
      updatedAt: winter.updatedAt,
    })
    expect(await repos.tireSets.get(summer.id)).toMatchObject({
      status: 'stored',
      updatedAt: summer.updatedAt,
    })
  })

  test('один комплект и снят, и установлен — ошибка у поля', async () => {
    const winter = await tireSet('stored', 'Nokian')
    renderAt('/record/new/service')
    await typeTitle('Переобувка')
    await userEvent.selectOptions(screen.getByLabelText('Тип работ'), 'tires')
    await selectSet('Установлен комплект', winter.id)
    await selectSet('Снят комплект', winter.id)
    await userEvent.type(screen.getByLabelText('Пробег'), '150000')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('Нельзя снять и установить один и тот же комплект')).toBeInTheDocument()
    expect(await db.records.count()).toBe(0)
  })
})

test('гарантия сохраняется датой и пробегом', async () => {
  const router = renderAt('/record/new/service')
  await typeTitle('Замена помпы')
  await userEvent.type(screen.getByLabelText('Гарантия до'), '2027-09-25')
  await userEvent.type(screen.getByLabelText('Гарантия до пробега'), '180000')
  await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
  await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/record\//))
  expect((await savedServices())[0]).toMatchObject({
    warrantyUntilDate: '2027-09-25',
    warrantyUntilKm: 180000,
  })
})
