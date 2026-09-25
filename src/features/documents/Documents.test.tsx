import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { addDays, todayISO } from '../../domain/dates'
import { formatDate } from '../../domain/format'
import type { Attachment, ID, OwnerType, VehicleDocument } from '../../domain/types'
import { ToastProvider } from '../../ui'
import DocumentPage from './DocumentPage'
import DocumentsPage from './DocumentsPage'

const store = vi.hoisted(() => ({
  addFile: vi.fn(),
  getThumbUrl: vi.fn(async (att: { id: string }) => `blob:thumb-${att.id}`),
  getOriginalUrl: vi.fn(async (att: { id: string }) => `blob:orig-${att.id}`),
  remove: vi.fn(),
}))
vi.mock('../../sync/index', () => ({
  attachmentStore: store,
  syncEngine: { subscribe: () => () => {}, getStatus: () => ({ state: 'off', pendingUploads: 0 }) },
  yandexAuth: { subscribe: () => () => {}, isConnected: () => false, getLoginError: () => null },
}))

const addAttachment = (ownerType: OwnerType, ownerId: ID, name = 'скан.jpg') =>
  repos.attachments.create({ ownerType, ownerId, kind: 'photo', name, mime: 'image/jpeg', size: 1000 })

const NBSP = '\u00a0'
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

function renderAt(path: string, history: string[] = []) {
  const router = createMemoryRouter(
    [
      { path: '/documents', element: <DocumentsPage /> },
      { path: '/documents/new', element: <DocumentPage /> },
      { path: '/documents/:id', element: <DocumentPage /> },
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
  })

const addDocument = (vehicleId: ID, patch: Partial<VehicleDocument>) =>
  repos.documents.create({ vehicleId, kind: 'osago', ...patch })

describe('список документов', () => {
  test('ОСАГО, которое кончается через 12 дней, — «Скоро»; без срока — без плашки; число файлов', async () => {
    const v = await addVehicle()
    const until = addDays(todayISO(), 12)
    await addDocument(v.id, { kind: 'osago', number: 'ХХХ 0123456789', validUntil: until })
    const sts = await addDocument(v.id, { kind: 'sts', number: '99 01 123456' })
    await addAttachment('document', sts.id, 'лицевая.jpg')
    await addAttachment('document', sts.id, 'оборот.jpg')
    renderAt('/documents')

    const row = await screen.findByRole('button', { name: /ОСАГО/ })
    expect(row).toHaveTextContent(`ХХХ 0123456789 · до ${formatDate(until)}`)
    await waitFor(() => expect(within(row).getByText('Скоро')).toBeInTheDocument())

    const stsRow = screen.getByRole('button', { name: /СТС/ })
    await waitFor(() => expect(stsRow.textContent).toContain(`2${NBSP}файла`))
    expect(within(stsRow).queryByText(/Скоро|В порядке|Просрочено/)).not.toBeInTheDocument()
  })

  test('старый полис при новом того же вида — «Заменён», а не «Просрочено»', async () => {
    const v = await addVehicle()
    await addDocument(v.id, { number: 'старый', validUntil: addDays(todayISO(), -300) })
    await addDocument(v.id, { number: 'новый', validUntil: addDays(todayISO(), 60) })
    renderAt('/documents')

    const old = await screen.findByRole('button', { name: /старый/ })
    await waitFor(() => expect(within(old).getByText('Заменён')).toBeInTheDocument())
    const fresh = screen.getByRole('button', { name: /новый/ })
    expect(within(fresh).getByText('В порядке')).toBeInTheDocument()
  })

  test('«Добавить документ» открывает форму', async () => {
    await addVehicle()
    const router = renderAt('/documents')
    await userEvent.click(await screen.findByRole('button', { name: 'Добавить документ' }))
    expect(router.state.location.pathname).toBe('/documents/new')
  })
})

describe('карточка документа', () => {
  test('новый документ «Другое» сохраняется с названием, номером и сроками', async () => {
    const v = await addVehicle()
    const router = renderAt('/documents/new', ['/documents'])

    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Вид' }), 'Другое')
    await userEvent.type(screen.getByRole('textbox', { name: 'Название' }), 'Гарантия')
    await userEvent.type(screen.getByRole('textbox', { name: 'Номер' }), 'G-17')
    fireEvent.change(screen.getByLabelText('Выдан'), { target: { value: '2026-01-15' } })
    fireEvent.change(screen.getByLabelText('Действует до'), { target: { value: '2029-01-15' } })
    await userEvent.upload(
      screen.getByLabelText('Добавить фото'),
      new File(['x'], 'талон.jpg', { type: 'image/jpeg' }),
    )
    await screen.findByRole('button', { name: 'Открыть «талон.jpg»' })
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/documents'))
    const [doc] = await repos.documents.list()
    expect(doc).toMatchObject({
      vehicleId: v.id,
      kind: 'other',
      title: 'Гарантия',
      number: 'G-17',
      issuedAt: '2026-01-15',
      validUntil: '2029-01-15',
    })
    const photos = await repos.attachments.list()
    expect(photos).toEqual([expect.objectContaining({ ownerType: 'document', ownerId: doc!.id })])
  })

  test('«Назад» без сохранения удаляет фото черновика', async () => {
    await addVehicle()
    const router = renderAt('/documents/new', ['/documents'])
    await userEvent.upload(
      await screen.findByLabelText('Добавить фото'),
      new File(['x'], 'полис.jpg', { type: 'image/jpeg' }),
    )
    await screen.findByRole('button', { name: 'Открыть «полис.jpg»' })
    await userEvent.click(screen.getByRole('button', { name: 'Назад' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/documents'))
    await waitFor(async () => expect(await repos.attachments.list()).toHaveLength(0))
    expect(store.remove).toHaveBeenCalledTimes(1)
    expect(await repos.documents.list()).toHaveLength(0)
  })

  test('карточка: срок и статус, правка номера, удаление с «Отменить»', async () => {
    const v = await addVehicle()
    const until = addDays(todayISO(), 12)
    const doc = await addDocument(v.id, { kind: 'diagCard', number: '0001', validUntil: until })
    const router = renderAt(`/documents/${doc.id}`, ['/documents'])

    const status = await screen.findByRole('region', { name: 'Срок действия' })
    expect(within(status).getByText('Скоро')).toBeInTheDocument()
    expect(status.textContent).toContain(`до ${formatDate(until)} · осталось 12${NBSP}дней`)

    const number = screen.getByRole('textbox', { name: 'Номер' })
    await userEvent.clear(number)
    await userEvent.type(number, '0002')
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => expect((await repos.documents.get(doc.id))?.number).toBe('0002'))

    await router.navigate(`/documents/${doc.id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Удалить документ' }))
    await waitFor(async () => expect(await repos.documents.get(doc.id)).toBeUndefined())
    expect(await screen.findByText('Документ удалён')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }))
    await waitFor(async () => expect(await repos.documents.get(doc.id)).toBeDefined())
  })
})
