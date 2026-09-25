import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { todayISO } from '../../domain/dates'
import { SnapshotError } from '../../domain/snapshot'
import { ToastProvider } from '../../ui'
import DataSettingsPage from './DataSettingsPage'
import { reloadPage } from './leave'

const fake = vi.hoisted(() => {
  const state = { connected: false }
  const status = { state: 'off', pendingUploads: 0 }
  return {
    state,
    backupService: {
      exportJson: vi.fn(async () => new Blob(['{}'], { type: 'application/json' })),
      exportExcel: vi.fn(async () => new Blob(['xlsx'])),
      previewImport: vi.fn(),
      importJson: vi.fn(async (_file: File, _mode: 'merge' | 'replace') => {}),
    },
    yandexAuth: { subscribe: () => () => {}, isConnected: () => state.connected, getLoginError: () => null },
    syncEngine: { subscribe: () => () => {}, getStatus: () => status, syncNow: async () => {} },
  }
})
vi.mock('../../sync/index', () => ({
  backupService: fake.backupService,
  yandexAuth: fake.yandexAuth,
  syncEngine: fake.syncEngine,
  attachmentStore: { getThumbUrl: async () => null, getOriginalUrl: async () => null },
}))
const files = vi.hoisted(() => ({ saveFile: vi.fn(async (_blob: Blob, _name: string) => {}) }))
vi.mock('../../sync/saveFile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../sync/saveFile')>()),
  saveFile: files.saveFile,
}))
vi.mock('./leave', () => ({ goToUrl: vi.fn(), reloadPage: vi.fn() }))

const PREVIEW = {
  exportedAt: new Date(2026, 8, 25, 12, 0).getTime(),
  counts: {
    vehicles: 2,
    records: 148,
    places: 12,
    masters: 3,
    catalogItems: 41,
    reminderRules: 6,
    documents: 2,
    tireSets: 1,
    attachments: 30,
  },
}

const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage')

beforeEach(async () => {
  await db.open()
  fake.state.connected = false
  files.saveFile.mockClear()
  vi.mocked(reloadPage).mockClear()
  Object.values(fake.backupService).forEach((f) => f.mockClear())
  fake.backupService.previewImport.mockResolvedValue(PREVIEW)
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  if (originalStorage) Object.defineProperty(navigator, 'storage', originalStorage)
  else delete (navigator as { storage?: unknown }).storage
})

const renderPage = () => {
  const router = createMemoryRouter(
    [
      { path: '/settings/data', element: <DataSettingsPage /> },
      { path: '*', element: <p>Другой экран</p> },
    ],
    { initialEntries: ['/settings/data'] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

const backupFile = () =>
  new File(['{"format":"myauto-garage"}'], 'moy-avto-2026-09-25.json', { type: 'application/json' })

const chooseFile = async (file = backupFile()) => {
  await userEvent.upload(screen.getByLabelText('Файл копии'), file)
  return file
}

describe('выгрузки', () => {
  test('JSON — saveFile с именем moy-avto-<дата>.json', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Выгрузить копию (JSON)' }))
    await waitFor(() => expect(files.saveFile).toHaveBeenCalledTimes(1))
    expect(files.saveFile.mock.calls[0]![1]).toBe(`moy-avto-${todayISO()}.json`)
    expect(fake.backupService.exportJson).toHaveBeenCalled()
  })

  test('Excel — saveFile с именем moy-avto-<дата>.xlsx', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Выгрузить в Excel' }))
    await waitFor(() => expect(files.saveFile).toHaveBeenCalledTimes(1))
    expect(files.saveFile.mock.calls[0]![1]).toBe(`moy-avto-${todayISO()}.xlsx`)
  })
})

describe('загрузка копии', () => {
  test('показывает, что в файле, и «Объединить» объединяет', async () => {
    renderPage()
    const file = await chooseFile()
    const preview = await screen.findByRole('region', { name: 'Загрузка копии' })
    expect(preview).toHaveTextContent('Файл от 25.09.2026: машин 2, записей 148, мест 12')
    expect(fake.backupService.previewImport).toHaveBeenCalledWith(file)
    await userEvent.click(within(preview).getByRole('button', { name: 'Объединить' }))
    await waitFor(() => expect(fake.backupService.importJson).toHaveBeenCalledWith(file, 'merge'))
    expect(await screen.findByText('Данные из копии объединены с этими')).toBeInTheDocument()
    expect(reloadPage).not.toHaveBeenCalled()
  })

  test('«Заменить всё» — только после второго подтверждения, затем перезагрузка', async () => {
    renderPage()
    const file = await chooseFile()
    const preview = await screen.findByRole('region', { name: 'Загрузка копии' })
    await userEvent.click(within(preview).getByRole('button', { name: 'Заменить всё' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Заменить всё?' })
    expect(dialog).toHaveTextContent('Текущие данные на этом устройстве будут заменены')
    expect(fake.backupService.importJson).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Заменить' }))
    await waitFor(() => expect(fake.backupService.importJson).toHaveBeenCalledWith(file, 'replace'))
    await waitFor(() => expect(reloadPage).toHaveBeenCalledTimes(1))
  })

  test('отмена второго подтверждения ничего не меняет', async () => {
    renderPage()
    await chooseFile()
    await userEvent.click(await screen.findByRole('button', { name: 'Заменить всё' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Заменить всё?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отменить' }))
    expect(fake.backupService.importJson).not.toHaveBeenCalled()
  })

  test('чужой файл — текст ошибки из SnapshotError', async () => {
    fake.backupService.previewImport.mockRejectedValue(new SnapshotError('Это не файл «Мой авто»'))
    renderPage()
    await chooseFile(new File(['hello'], 'notes.json'))
    expect(await screen.findByText('Это не файл «Мой авто»')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Объединить' })).not.toBeInTheDocument()
  })
})

describe('восстановление на новом устройстве', () => {
  const addVehicle = () =>
    repos.vehicles.create({
      name: 'Lada 2109',
      make: 'Lada',
      model: '2109',
      archived: false,
      fluids: [],
      order: 0,
    })

  test('копия принесла машину — «Перейти на главную» ведёт на главную', async () => {
    fake.backupService.importJson.mockImplementationOnce(async () => {
      await addVehicle()
    })
    const router = renderPage()
    await chooseFile()
    await userEvent.click(await screen.findByRole('button', { name: 'Объединить' }))
    const home = await screen.findByRole('button', { name: 'Перейти на главную' })
    await userEvent.click(home)
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  test('машины уже были, копию не загружали — кнопки нет', async () => {
    await addVehicle()
    renderPage()
    await screen.findByRole('button', { name: 'Загрузить копию' })
    // Живой запрос машин успевает ответить.
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('button', { name: 'Перейти на главную' })).not.toBeInTheDocument()
  })

  test('копия без машин — кнопки нет', async () => {
    renderPage()
    await chooseFile()
    await userEvent.click(await screen.findByRole('button', { name: 'Объединить' }))
    await screen.findByText('Данные из копии объединены с этими')
    expect(screen.queryByRole('button', { name: 'Перейти на главную' })).not.toBeInTheDocument()
  })
})

describe('хранилище и Диск', () => {
  test('без Диска — предупреждение', () => {
    renderPage()
    expect(screen.getByText('Копии на Диске нет — подключите Яндекс.Диск')).toBeInTheDocument()
  })

  test('Диск подключён — без предупреждения', () => {
    fake.state.connected = true
    renderPage()
    expect(screen.queryByText('Копии на Диске нет — подключите Яндекс.Диск')).not.toBeInTheDocument()
  })

  test('занято и доступно, защита от очистки', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: async () => ({ usage: 12_400_000, quota: 2 * 1024 ** 3 }),
        persisted: async () => true,
      },
    })
    renderPage()
    const storage = screen.getByRole('list', { name: 'Хранилище' })
    await waitFor(() => expect(storage).toHaveTextContent('11,8 МБ из 2 ГБ'))
    const persisted = within(storage).getByText('Защищено от очистки').closest('li')!
    await waitFor(() => expect(persisted).toHaveTextContent(/да$/))
  })
})
