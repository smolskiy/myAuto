import { IconArrowRight } from '@tabler/icons-react'
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { createHashRouter, createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import type { Attachment, ID, OwnerType } from '../../domain/types'
import { ToastProvider } from '../../ui'
import {
  AttachmentsField,
  CatalogItemPicker,
  FormPage,
  MasterPicker,
  Page,
  PlacePicker,
  useDraftAttachments,
  UserError,
  VehicleGate,
} from './index'

// Фейковое хранилище вложений: строки — в настоящей базе (fake-indexeddb), файлов нет.
const store = vi.hoisted(() => ({
  addFile: vi.fn(),
  getThumbUrl: vi.fn(async (att: { id: string }) => `blob:thumb-${att.id}`),
  getOriginalUrl: vi.fn(async (att: { id: string }) => `blob:orig-${att.id}`),
  remove: vi.fn(),
  pendingCount: vi.fn(async () => 0),
}))
vi.mock('../../sync/index', () => ({
  attachmentStore: store,
  syncEngine: { subscribe: () => () => {}, getStatus: () => ({ state: 'off', pendingUploads: 0 }) },
  yandexAuth: { subscribe: () => () => {}, isConnected: () => false, getLoginError: () => null },
}))

const addAttachment = (ownerType: OwnerType, ownerId: ID, name = 'чек.jpg') =>
  repos.attachments.create({ ownerType, ownerId, kind: 'photo', name, mime: 'image/jpeg', size: 1000 })

const revoke = URL.revokeObjectURL
beforeEach(async () => {
  await db.open()
  URL.revokeObjectURL = () => {}
  store.remove.mockImplementation((att: Attachment) => repos.attachments.remove(att.id))
  store.addFile.mockImplementation((owner: { ownerType: OwnerType; ownerId: ID }, file: File) =>
    addAttachment(owner.ownerType, owner.ownerId, file.name),
  )
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  URL.revokeObjectURL = revoke
})

const inApp = (ui: ReactNode) =>
  render(
    <ToastProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ToastProvider>,
  )

/** Роутер с двумя экранами: список и форма поверх него. */
const withHistory = (form: ReactNode) => {
  const router = createMemoryRouter(
    [
      { path: '/', element: <p>Список</p> },
      { path: '/form', element: form },
    ],
    { initialEntries: ['/', '/form'], initialIndex: 1 },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

describe('выбор места и мастера', () => {
  function PlaceHarness({ onChange }: { onChange(id?: ID): void }) {
    const [value, setValue] = useState<ID | undefined>()
    return (
      <PlacePicker
        label="АЗС"
        kinds={['fuel']}
        value={value}
        onChange={(id) => {
          setValue(id)
          onChange(id)
        }}
      />
    )
  }

  test('PlacePicker создаёт новое место нужного вида и отдаёт его id', async () => {
    const onChange = vi.fn()
    inApp(<PlaceHarness onChange={onChange} />)
    await userEvent.type(screen.getByRole('combobox', { name: 'АЗС' }), 'Лукойл на Кольцевой')
    await userEvent.click(screen.getByRole('option', { name: 'Создать «Лукойл на Кольцевой»' }))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.any(String)))
    const id = onChange.mock.lastCall![0] as ID
    expect(await repos.places.get(id)).toMatchObject({ kind: 'fuel', name: 'Лукойл на Кольцевой' })
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'АЗС' })).toHaveValue('Лукойл на Кольцевой'),
    )
  })

  test('PlacePicker предлагает места только своих видов и выбирает по касанию', async () => {
    const station = await repos.places.create({ kind: 'fuel', name: 'Лукойл' })
    await repos.places.create({ kind: 'service', name: 'Лукойл-сервис' })
    const onChange = vi.fn()
    inApp(<PlaceHarness onChange={onChange} />)
    await userEvent.type(screen.getByRole('combobox', { name: 'АЗС' }), 'лук')
    const options = await screen.findAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Лукойл', 'Создать «лук»'])
    await userEvent.click(screen.getByRole('option', { name: 'Лукойл' }))
    expect(onChange).toHaveBeenLastCalledWith(station.id)
  })

  test('PlacePicker allowCreate={false} — только выбор, «Создать «…»» нет', async () => {
    await repos.places.create({ kind: 'fuel', name: 'Лукойл' })
    inApp(<PlacePicker label="Место" kinds={['fuel']} allowCreate={false} onChange={() => {}} />)
    await userEvent.type(screen.getByRole('combobox', { name: 'Место' }), 'лук')
    const options = await screen.findAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['Лукойл'])
    await userEvent.clear(screen.getByRole('combobox', { name: 'Место' }))
    await userEvent.type(screen.getByRole('combobox', { name: 'Место' }), 'Роснефть')
    expect(screen.queryByRole('option', { name: 'Создать «Роснефть»' })).not.toBeInTheDocument()
  })

  test('PlacePicker показывает имя выбранного места, даже удалённого', async () => {
    const place = await repos.places.create({ kind: 'service', name: 'Старый сервис' })
    await repos.places.remove(place.id)
    inApp(<PlacePicker label="Место" kinds={['service']} value={place.id} onChange={() => {}} />)
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Место' })).toHaveValue('Старый сервис'))
  })

  test('MasterPicker показывает только мастеров выбранного места', async () => {
    const a = await repos.places.create({ kind: 'service', name: 'Автосервис' })
    const b = await repos.places.create({ kind: 'service', name: 'Дилер' })
    await repos.masters.create({ name: 'Сергей', placeId: a.id })
    await repos.masters.create({ name: 'Андрей', placeId: b.id })
    inApp(<MasterPicker placeId={a.id} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('combobox', { name: 'Мастер' }))
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Сергей']))
  })

  test('MasterPicker создаёт мастера в выбранном месте', async () => {
    const a = await repos.places.create({ kind: 'service', name: 'Автосервис' })
    const onChange = vi.fn()
    inApp(<MasterPicker placeId={a.id} onChange={onChange} />)
    await userEvent.type(screen.getByRole('combobox', { name: 'Мастер' }), 'Павел')
    await userEvent.click(screen.getByRole('option', { name: 'Создать «Павел»' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.any(String)))
    expect(await repos.masters.get(onChange.mock.lastCall![0] as ID)).toMatchObject({
      name: 'Павел',
      placeId: a.id,
    })
  })

  test('CatalogItemPicker ищет по каталогу, группа — в подсказке, отдаёт id и позицию', async () => {
    const onChange = vi.fn()
    inApp(<CatalogItemPicker onChange={onChange} />)
    await userEvent.type(screen.getByRole('combobox', { name: 'Узел' }), 'моторное')
    const option = await screen.findByRole('option', { name: /Моторное масло/ })
    expect(option).toHaveTextContent('Двигатель')
    await userEvent.click(option)
    expect(onChange).toHaveBeenLastCalledWith(
      'item.engine_oil',
      expect.objectContaining({ name: 'Моторное масло' }),
    )
  })
})

describe('вложения', () => {
  test('useDraftAttachments.discard() удаляет вложения черновика, чужие не трогает', async () => {
    const { result } = renderHook(() => useDraftAttachments('record'))
    const ownerId = result.current.ownerId
    expect(ownerId).toMatch(/[0-9a-f-]{36}/)
    const mine = await addAttachment('record', ownerId)
    const other = await addAttachment('record', 'someone-else')

    await act(() => result.current.discard())

    expect(store.remove).toHaveBeenCalledTimes(1)
    expect(store.remove).toHaveBeenCalledWith(expect.objectContaining({ id: mine.id }))
    expect(await repos.attachments.get(mine.id)).toBeUndefined()
    expect(await repos.attachments.get(other.id)).toBeDefined()
  })

  test('ownerId черновика не меняется между отрисовками', () => {
    const { result, rerender } = renderHook(() => useDraftAttachments('record'))
    const first = result.current.ownerId
    rerender()
    expect(result.current.ownerId).toBe(first)
  })

  const saveRecord = (id: ID) =>
    repos.records.create({ id, vehicleId: 'v1', kind: 'note', date: '2026-09-25', total: 0, title: 'Стук' })

  test('discard() не трогает вложения уже сохранённой строки', async () => {
    const { result } = renderHook(() => useDraftAttachments('record'))
    const att = await addAttachment('record', result.current.ownerId)
    await saveRecord(result.current.ownerId)
    await act(() => result.current.discard())
    expect(store.remove).not.toHaveBeenCalled()
    expect(await repos.attachments.get(att.id)).toBeDefined()
  })

  test('discard(): строка сохранена, но удалена — вложения убираются', async () => {
    const { result } = renderHook(() => useDraftAttachments('record'))
    const att = await addAttachment('record', result.current.ownerId)
    await saveRecord(result.current.ownerId)
    await repos.records.remove(result.current.ownerId)
    await act(() => result.current.discard())
    expect(await repos.attachments.get(att.id)).toBeUndefined()
  })

  test('уход с формы без сохранения (жест «назад», любой переход) убирает вложения черновика', async () => {
    const { result, unmount } = renderHook(() => useDraftAttachments('record'))
    const att = await addAttachment('record', result.current.ownerId)
    unmount()
    await waitFor(async () => expect(await repos.attachments.get(att.id)).toBeUndefined())
  })

  test('уход с формы после сохранения вложения не трогает', async () => {
    const { result, unmount } = renderHook(() => useDraftAttachments('record'))
    const att = await addAttachment('record', result.current.ownerId)
    await saveRecord(result.current.ownerId)
    unmount()
    await new Promise((r) => setTimeout(r, 50))
    expect(store.remove).not.toHaveBeenCalled()
    expect(await repos.attachments.get(att.id)).toBeDefined()
  })

  test('сбой уборки при уходе — только предупреждение в консоли', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    store.remove.mockRejectedValueOnce(new Error('база недоступна'))
    const { result, unmount } = renderHook(() => useDraftAttachments('record'))
    await addAttachment('record', result.current.ownerId)
    unmount()
    await waitFor(() => expect(warn).toHaveBeenCalled())
  })

  test('AttachmentsField добавляет фото, показывает превью и удаляет с «Отменить»', async () => {
    inApp(<AttachmentsField ownerType="record" ownerId="r1" />)
    expect(screen.getByRole('group', { name: 'Фото и документы' })).toBeInTheDocument()
    const file = new File(['x'], 'заказ-наряд.jpg', { type: 'image/jpeg' })
    await userEvent.upload(screen.getByLabelText('Добавить фото'), file)
    const thumb = await screen.findByRole('button', { name: 'Открыть «заказ-наряд.jpg»' })
    await waitFor(() =>
      expect(within(thumb).getByRole('presentation')).toHaveAttribute(
        'src',
        expect.stringMatching(/^blob:thumb-/),
      ),
    )

    await userEvent.click(screen.getByRole('button', { name: 'Удалить «заказ-наряд.jpg»' }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Открыть «заказ-наряд.jpg»' })).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Фото удалено')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }))
    expect(await screen.findByRole('button', { name: 'Открыть «заказ-наряд.jpg»' })).toBeInTheDocument()
  })

  test('AttachmentsField: неподходящий файл — ошибка уведомлением', async () => {
    store.addFile.mockRejectedValueOnce(new Error('Такой файл не подходит: нужно фото или PDF'))
    inApp(<AttachmentsField ownerType="record" ownerId="r1" />)
    await userEvent.upload(
      screen.getByLabelText('Добавить фото'),
      new File(['x'], 'photo.jpg', { type: 'image/jpeg' }),
    )
    expect(await screen.findByText('Такой файл не подходит: нужно фото или PDF')).toBeInTheDocument()
  })

  test('AttachmentsField открывает оригинал в просмотре', async () => {
    await addAttachment('record', 'r1', 'чек.jpg')
    inApp(<AttachmentsField ownerType="record" ownerId="r1" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Открыть «чек.jpg»' }))
    const viewer = await screen.findByRole('dialog', { name: 'чек.jpg' })
    await waitFor(() =>
      expect(within(viewer).getByRole('img', { name: 'чек.jpg' })).toHaveAttribute(
        'src',
        expect.stringMatching(/^blob:orig-/),
      ),
    )
  })
})

describe('каркасы страниц', () => {
  test('VehicleGate без машин — «Добавьте машину» с кнопкой в форму машины', async () => {
    const router = createMemoryRouter([
      { path: '/', element: <VehicleGate>{(v) => <p>{v.name}</p>}</VehicleGate> },
      { path: '/vehicle/new', element: <p>Новая машина</p> },
    ])
    render(<RouterProvider router={router} />)
    expect(await screen.findByText('Добавьте машину')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Добавить машину' }))
    expect(router.state.location.pathname).toBe('/vehicle/new')
  })

  test('VehicleGate с машиной отдаёт её детям', async () => {
    await repos.vehicles.create({
      name: 'Октавия',
      make: 'Skoda',
      model: 'Octavia',
      archived: false,
      fluids: [],
      order: 0,
    })
    inApp(<VehicleGate>{(v) => <p>Машина: {v.name}</p>}</VehicleGate>)
    expect(await screen.findByText('Машина: Октавия')).toBeInTheDocument()
  })

  test('Page: заголовок h1 и «Назад» по истории', async () => {
    const router = withHistory(
      <Page title="Статистика" back>
        <p>Графики</p>
      </Page>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Статистика' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  test('Page: «Назад» на открытом по ссылке экране ведёт на главную', async () => {
    const router = createMemoryRouter(
      [
        { path: '/', element: <p>Главная</p> },
        { path: '/stats', element: <Page title="Статистика" back /> },
      ],
      { initialEntries: ['/stats'] },
    )
    render(<RouterProvider router={router} />)
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  test('Page: back="/путь" — это запасной путь «Назад», а не переход вперёд', async () => {
    const router = withHistory(<Page title="Машина" back="/garage" />)
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    // История есть — шаг назад, а не новая запись /garage поверх формы.
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  test('Page: back="/путь" с глубокой ссылки — на этот путь, заменой', async () => {
    const router = createMemoryRouter(
      [
        { path: '/garage', element: <p>Гараж</p> },
        { path: '/vehicle/:id', element: <Page title="Машина" back="/garage" /> },
      ],
      { initialEntries: ['/vehicle/v1'] },
    )
    render(<RouterProvider router={router} />)
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/garage'))
    expect(router.state.historyAction).toBe('REPLACE')
  })

  test('Page (hash-роутер): после замены первой записи истории «Назад» не уводит из приложения', async () => {
    window.history.replaceState(null, '', '#/')
    const router = createHashRouter([
      { path: '/', element: <p>Главная</p> },
      { path: '/onboarding', element: <Page title="Добро пожаловать" back /> },
    ])
    render(<RouterProvider router={router} />)
    // Как редирект первого запуска: замена первой записи — ключ уже не 'default', но истории в приложении нет.
    await act(() => router.navigate('/onboarding', { replace: true }))
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    router.dispose()
  })

  test('FormPage: успешное сохранение закрывает форму', async () => {
    const onSave = vi.fn(async () => {})
    const router = withHistory(
      <FormPage title="Новая заправка" onSave={onSave}>
        <p>Поля</p>
      </FormPage>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Новая заправка' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(onSave).toHaveBeenCalledOnce()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  test('FormPage: ошибка сохранения — уведомлением, форма остаётся открытой', async () => {
    const router = withHistory(
      <FormPage
        title="Новая заправка"
        onSave={async () => {
          throw new UserError('Укажите пробег')
        }}
      >
        <p>Поля</p>
      </FormPage>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('Укажите пробег')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/form')
  })

  test('FormPage: сбой (не UserError) — общий русский текст, подробности в консоль', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bug = new TypeError("Cannot read properties of undefined (reading 'odometer')")
    const router = withHistory(
      <FormPage
        title="Новая заправка"
        onSave={async () => {
          throw bug
        }}
      >
        <p>Поля</p>
      </FormPage>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByText('Не получилось сохранить — попробуйте ещё раз')).toBeInTheDocument()
    expect(screen.queryByText(/Cannot read/)).not.toBeInTheDocument()
    expect(consoleError).toHaveBeenCalledWith(bug)
    expect(router.state.location.pathname).toBe('/form')
  })

  test('PlacePicker: место не сохранилось — общий русский текст', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(repos.places, 'create').mockRejectedValueOnce(
      new DOMException('Quota exceeded', 'QuotaExceededError'),
    )
    inApp(<PlacePicker label="Место" kinds={['service']} onChange={() => {}} />)
    await userEvent.type(screen.getByRole('combobox', { name: 'Место' }), 'Сервис')
    await userEvent.click(screen.getByRole('option', { name: 'Создать «Сервис»' }))
    expect(await screen.findByText('Не получилось сохранить — попробуйте ещё раз')).toBeInTheDocument()
  })

  test('AttachmentsField: непредвиденный сбой добавления — общий русский текст', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    store.addFile.mockRejectedValueOnce(new DOMException('Quota exceeded', 'QuotaExceededError'))
    inApp(<AttachmentsField ownerType="record" ownerId="r1" />)
    await userEvent.upload(
      screen.getByLabelText('Добавить фото'),
      new File(['x'], 'p.jpg', { type: 'image/jpeg' }),
    )
    expect(await screen.findByText('Не получилось добавить файл — попробуйте ещё раз')).toBeInTheDocument()
  })

  test('FormPage: backHidden — без «Назад» (первый экран первого запуска)', () => {
    withHistory(
      <FormPage title="Добро пожаловать" onSave={async () => {}} backHidden>
        <p>Поля</p>
      </FormPage>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Добро пожаловать' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Назад' })).not.toBeInTheDocument()
  })

  test('FormPage: значок «Сохранить» — дискета по умолчанию, свой или никакого', () => {
    const { unmount } = inApp(
      <FormPage title="Новая заправка" onSave={async () => {}}>
        <p>Поля</p>
      </FormPage>,
    )
    const save = () => screen.getByRole('button', { name: 'Дальше' })
    expect(
      screen.getByRole('button', { name: 'Сохранить' }).querySelector('.tabler-icon-device-floppy'),
    ).not.toBeNull()
    unmount()

    const second = inApp(
      <FormPage title="Машина" saveLabel="Дальше" saveIcon={<IconArrowRight />} onSave={async () => {}}>
        <p>Поля</p>
      </FormPage>,
    )
    expect(save().querySelector('.tabler-icon-arrow-right')).not.toBeNull()
    expect(save().querySelector('.tabler-icon-device-floppy')).toBeNull()
    second.unmount()

    inApp(
      <FormPage title="Машина" saveLabel="Дальше" saveIcon={null} onSave={async () => {}}>
        <p>Поля</p>
      </FormPage>,
    )
    expect(save().querySelector('svg')).toBeNull()
  })

  test('Page: back — функция: «Назад» вызывает её, без перехода по истории', async () => {
    const onBack = vi.fn()
    const router = withHistory(<Page title="Что напоминать" back={onBack} />)
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(onBack).toHaveBeenCalledOnce()
    expect(router.state.location.pathname).toBe('/form')
  })

  test('FormPage: «Назад» вызывает onCancel и закрывает форму', async () => {
    const onCancel = vi.fn()
    const router = withHistory(
      <FormPage title="Новая заправка" onSave={async () => {}} onCancel={onCancel}>
        <p>Поля</p>
      </FormPage>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(onCancel).toHaveBeenCalledOnce()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  test('FormPage: пока идёт сохранение, повторное нажатие не сохраняет ещё раз', async () => {
    let finish!: () => void
    const onSave = vi.fn(() => new Promise<void>((r) => (finish = r)))
    withHistory(
      <FormPage title="Новая заправка" onSave={onSave}>
        <p>Поля</p>
      </FormPage>,
    )
    const save = screen.getByRole('button', { name: 'Сохранить' })
    await userEvent.click(save)
    await userEvent.click(save)
    expect(onSave).toHaveBeenCalledOnce()
    await act(async () => finish())
  })

  test('FormPage: пока идёт сохранение, «Назад» не срабатывает', async () => {
    let finish!: () => void
    const onCancel = vi.fn()
    const router = withHistory(
      <FormPage
        title="Новая заправка"
        onSave={() => new Promise<void>((r) => (finish = r))}
        onCancel={onCancel}
      >
        <p>Поля</p>
      </FormPage>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(onCancel).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/form')
    await act(async () => finish())
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  test('FormPage: onSave вернул путь — форма заменяется этим экраном', async () => {
    const router = createMemoryRouter(
      [
        { path: '/', element: <p>Главная</p> },
        { path: '/journal', element: <p>Журнал</p> },
        {
          path: '/record/new',
          element: (
            <FormPage title="Новая запись" onSave={async () => '/record/r1'}>
              <p>Поля</p>
            </FormPage>
          ),
        },
        { path: '/record/:id', element: <p>Карточка</p> },
      ],
      { initialEntries: ['/', '/journal', '/record/new'], initialIndex: 2 },
    )
    render(
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/record/r1'))
    // Форма заменена, а не добавлена: «назад» с карточки ведёт туда, откуда форму открыли.
    await act(() => router.navigate(-1))
    expect(router.state.location.pathname).toBe('/journal')
  })

  test('FormPage: onSave вернул false — форма остаётся, без уведомления и перехода', async () => {
    const onSave = vi.fn(async () => false as const)
    const router = withHistory(
      <FormPage title="Новая заправка" onSave={onSave}>
        <p>Поля</p>
      </FormPage>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(onSave).toHaveBeenCalledOnce()
    await new Promise((r) => setTimeout(r, 30))
    expect(router.state.location.pathname).toBe('/form')
    expect(screen.queryByRole('status')).toBeEmptyDOMElement()
    // Кнопка снова доступна — можно исправить поле и сохранить ещё раз.
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(onSave).toHaveBeenCalledTimes(2)
  })
})
