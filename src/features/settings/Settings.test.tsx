import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { NBSP } from '../../domain/format'
import { THEME_STORAGE_KEY, ThemeProvider, ToastProvider } from '../../ui'
import MorePage from '../more/MorePage'
import { goToUrl } from './leave'
import SettingsPage from './SettingsPage'
import SyncSettingsPage from './SyncSettingsPage'
import { agoText, syncStateText } from './syncText'

/** Подменные службы синхронизации: состояние меняет тест, подписчики узнают об этом. */
const fake = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  const state = {
    connected: false,
    clientId: null as string | null,
    loginError: null as string | null,
    status: { state: 'off', pendingUploads: 0 } as {
      state: string
      pendingUploads: number
      lastSyncAt?: number
      error?: string
    },
  }
  const notify = () => listeners.forEach((cb) => cb())
  const subscribe = (cb: () => void) => {
    listeners.add(cb)
    return () => void listeners.delete(cb)
  }
  return {
    state,
    notify,
    yandexAuth: {
      subscribe,
      isConnected: () => state.connected,
      getClientId: () => state.clientId,
      setClientId: vi.fn((id: string) => {
        state.clientId = id.trim() || null
      }),
      getLoginError: () => state.loginError,
      loginUrl: vi.fn(() => 'https://oauth.yandex.ru/authorize?client_id=abc'),
      verificationCodeUrl: vi.fn(() => 'https://oauth.yandex.ru/authorize?redirect_uri=verification_code'),
      connectWithCode: vi.fn(async (_code: string) => {}),
      disconnect: vi.fn(async () => {
        state.connected = false
        notify()
      }),
    },
    syncEngine: { subscribe, getStatus: () => state.status, syncNow: vi.fn(async () => {}) },
  }
})
vi.mock('../../sync/index', () => ({
  yandexAuth: fake.yandexAuth,
  syncEngine: fake.syncEngine,
  attachmentStore: { getThumbUrl: async () => null, getOriginalUrl: async () => null },
}))
vi.mock('./leave', () => ({ goToUrl: vi.fn() }))

beforeEach(async () => {
  await db.open()
  Object.assign(fake.state, {
    connected: false,
    clientId: null,
    loginError: null,
    status: { state: 'off', pendingUploads: 0 },
  })
  vi.mocked(goToUrl).mockClear()
  fake.yandexAuth.connectWithCode.mockClear()
  fake.yandexAuth.setClientId.mockClear()
  fake.yandexAuth.disconnect.mockClear()
  fake.syncEngine.syncNow.mockClear()
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  localStorage.clear()
  vi.unstubAllEnvs()
})

const renderAt = (path: string, element: ReactNode) => {
  const router = createMemoryRouter(
    [
      { path, element },
      { path: '*', element: <p>Другой экран</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <ThemeProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </ThemeProvider>,
  )
  return router
}

describe('«Ещё»', () => {
  test('три группы со ссылками на разделы', async () => {
    const router = renderAt('/more', <MorePage />)
    const car = screen.getByRole('list', { name: 'Машина' })
    expect(
      within(car)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Статистика', 'Гараж', 'Документы', 'Шины'])
    expect(
      within(screen.getByRole('list', { name: 'Справочники' }))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Места и мастера', 'Узлы и расходники'])
    const app = screen.getByRole('list', { name: 'Приложение' })
    expect(within(app).getByRole('button', { name: /Витрина компонентов/ })).toBeInTheDocument()
    await userEvent.click(within(car).getByRole('button', { name: 'Статистика' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/stats'))
  })
})

describe('настройки', () => {
  test('тема переключается и запоминается', async () => {
    renderAt('/settings', <SettingsPage />)
    const theme = screen.getByRole('radiogroup', { name: 'Тема' })
    expect(within(theme).getByRole('radio', { name: 'Как в системе' })).toBeChecked()
    await userEvent.click(within(theme).getByRole('radio', { name: 'Тёмная' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    await userEvent.click(within(theme).getByRole('radio', { name: 'Как в системе' }))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  test('«О приложении» — версия из package.json', () => {
    renderAt('/settings', <SettingsPage />)
    const about = screen.getByRole('list', { name: 'О приложении' })
    expect(within(about).getByText('0.1.0')).toBeInTheDocument()
  })
})

describe('синхронизация', () => {
  test('не подключено — состояние словами и кнопки входа', async () => {
    fake.state.clientId = 'abc'
    vi.stubEnv('VITE_YANDEX_CLIENT_ID', 'abc')
    renderAt('/settings/sync', <SyncSettingsPage />)
    expect(screen.getByText('Не подключено')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'ClientID' })).not.toBeInTheDocument()
    const login = screen.getByRole('button', { name: 'Войти через Яндекс' })
    expect(login).toBeEnabled()
    await userEvent.click(login)
    expect(goToUrl).toHaveBeenCalledWith('https://oauth.yandex.ru/authorize?client_id=abc')
    expect(screen.getByRole('button', { name: 'Войти по коду' })).toBeInTheDocument()
  })

  test('без ClientID в сборке — поле ClientID, вход недоступен, пока поле пустое', async () => {
    vi.stubEnv('VITE_YANDEX_CLIENT_ID', '')
    renderAt('/settings/sync', <SyncSettingsPage />)
    const field = screen.getByRole('textbox', { name: 'ClientID' })
    expect(screen.getByText('oauth.yandex.ru → ваше приложение → ClientID')).toBeInTheDocument()
    const login = screen.getByRole('button', { name: 'Войти через Яндекс' })
    expect(login).toBeDisabled()
    expect(login).toHaveAccessibleDescription('Сначала укажите ClientID')
    await userEvent.type(field, ' my-client ')
    expect(login).toBeEnabled()
    await userEvent.click(login)
    expect(fake.yandexAuth.setClientId).toHaveBeenCalledWith('my-client')
    expect(goToUrl).toHaveBeenCalledTimes(1)
  })

  test('вход по коду: страница Яндекса в новой вкладке, код уходит в connectWithCode', async () => {
    fake.state.clientId = 'abc'
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    renderAt('/settings/sync', <SyncSettingsPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Войти по коду' }))
    expect(open).toHaveBeenCalledWith(
      'https://oauth.yandex.ru/authorize?redirect_uri=verification_code',
      '_blank',
      'noopener',
    )
    await userEvent.type(screen.getByLabelText('Код со страницы Яндекса'), 'y0_abc')
    await userEvent.click(screen.getByRole('button', { name: 'Подключить' }))
    expect(fake.yandexAuth.connectWithCode).toHaveBeenCalledWith('y0_abc')
  })

  test('код — это токен: поле скрыто, без автоисправлений, после неудачи очищается', async () => {
    fake.state.clientId = 'abc'
    vi.spyOn(window, 'open').mockReturnValue(null)
    fake.yandexAuth.connectWithCode.mockRejectedValueOnce(new Error('Код не подошёл — получите новый'))
    renderAt('/settings/sync', <SyncSettingsPage />)
    await userEvent.click(screen.getByRole('button', { name: 'Войти по коду' }))
    const field = screen.getByLabelText('Код со страницы Яндекса')
    expect(field).toHaveAttribute('type', 'password')
    expect(field).toHaveAttribute('autocapitalize', 'off')
    expect(field).toHaveAttribute('autocorrect', 'off')
    expect(field).toHaveAttribute('spellcheck', 'false')
    await userEvent.type(field, 'y0_wrong')
    await userEvent.click(screen.getByRole('button', { name: 'Подключить' }))
    await waitFor(() => expect(field).toHaveValue(''))
  })

  test('ошибка входа видна текстом', () => {
    fake.state.loginError = 'Код не подошёл — получите новый'
    renderAt('/settings/sync', <SyncSettingsPage />)
    expect(screen.getByText('Код не подошёл — получите новый')).toBeInTheDocument()
  })

  test('подключено: давность, ждущие фото, «Синхронизировать сейчас», «Выйти» с подтверждением', async () => {
    Object.assign(fake.state, {
      connected: true,
      clientId: 'abc',
      status: { state: 'idle', pendingUploads: 3, lastSyncAt: Date.now() - 5 * 60_000 },
    })
    renderAt('/settings/sync', <SyncSettingsPage />)
    expect(screen.getByText('Синхронизировано 5 минут назад')).toBeInTheDocument()
    expect(screen.getByText('Ждут загрузки: 3 фото')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Войти через Яндекс' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Синхронизировать сейчас' }))
    expect(fake.syncEngine.syncNow).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }))
    const dialog = await screen.findByRole('alertdialog', { name: 'Выйти из Яндекса?' })
    expect(fake.yandexAuth.disconnect).not.toHaveBeenCalled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Выйти' }))
    expect(fake.yandexAuth.disconnect).toHaveBeenCalledTimes(1)
  })

  test('папка на Диске описана', () => {
    renderAt('/settings/sync', <SyncSettingsPage />)
    expect(screen.getByRole('heading', { name: 'Что хранится на Диске' })).toBeInTheDocument()
    expect(screen.getByText('Приложения/Мой авто/')).toBeInTheDocument()
  })

  const addVehicle = () =>
    repos.vehicles.create({
      name: 'Lada 2109',
      make: 'Lada',
      model: '2109',
      archived: false,
      fluids: [],
      order: 0,
    })

  test('новое устройство: синхронизация принесла машину — «Перейти на главную» ведёт на главную', async () => {
    Object.assign(fake.state, {
      connected: true,
      status: { state: 'idle', pendingUploads: 0, lastSyncAt: Date.now() },
    })
    const router = renderAt('/settings/sync', <SyncSettingsPage />)
    // Живой запрос машин ответил «пусто» — экран открыт без машин.
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('button', { name: 'Перейти на главную' })).not.toBeInTheDocument()
    await addVehicle()
    await userEvent.click(await screen.findByRole('button', { name: 'Перейти на главную' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  test('машины были и до входа на экран — кнопки нет', async () => {
    await addVehicle()
    Object.assign(fake.state, {
      connected: true,
      status: { state: 'idle', pendingUploads: 0, lastSyncAt: Date.now() },
    })
    renderAt('/settings/sync', <SyncSettingsPage />)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('button', { name: 'Перейти на главную' })).not.toBeInTheDocument()
  })
})

describe('тексты синхронизации', () => {
  const NOW = new Date(2026, 8, 25, 14, 30).getTime()
  test('давность', () => {
    expect(agoText(NOW - 20_000, NOW)).toBe('только что')
    expect(agoText(NOW - 5 * 60_000, NOW)).toBe(`5${NBSP}минут назад`)
    expect(agoText(NOW - 21 * 60_000, NOW)).toBe(`21${NBSP}минуту назад`)
    expect(agoText(NOW - 3 * 3600_000, NOW)).toBe(`3${NBSP}часа назад`)
    expect(agoText(new Date(2026, 8, 20, 9, 5).getTime(), NOW)).toBe('20.09.2026 в 09:05')
  })
  test('состояние', () => {
    expect(syncStateText({ state: 'off', pendingUploads: 0 }, NOW)).toBe('Не подключено')
    expect(syncStateText({ state: 'offline', pendingUploads: 0 }, NOW)).toBe(
      'Нет сети — изменения уйдут позже',
    )
    expect(syncStateText({ state: 'error', error: 'На Диске нет места', pendingUploads: 0 }, NOW)).toBe(
      'На Диске нет места',
    )
    expect(syncStateText({ state: 'syncing', pendingUploads: 0 }, NOW)).toBe('Синхронизация…')
    expect(syncStateText({ state: 'idle', pendingUploads: 0, lastSyncAt: NOW - 60_000 }, NOW)).toBe(
      `Синхронизировано 1${NBSP}минуту назад`,
    )
    expect(syncStateText({ state: 'idle', pendingUploads: 0 }, NOW)).toBe('Подключено')
  })
})
