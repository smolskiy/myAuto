import { act, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { expense, fuel, note, odo, service } from '../../domain/calc/fixtures'
import { CATALOG_ID } from '../../domain/catalog'
import { NBSP } from '../../domain/format'
import * as domainLabels from '../../domain/labels'
import { ToastProvider } from '../../ui'
import {
  DRIVE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  FUEL_TYPE_LABELS,
  RECORD_KIND_LABELS,
  SERVICE_TYPE_LABELS,
  TRANSMISSION_LABELS,
} from './labels'
import { RECORD_KIND_ICON, recordRowProps, recordSubtitle, recordTitle } from './recordPresentation'
import { useLookup } from './useLookup'
import { UserError } from './errors'
import { useSoftDelete } from './useSoftDelete'
import { useToday } from './useToday'

const lookup = {
  places: new Map([
    ['pl', { id: 'pl', createdAt: 1, updatedAt: 1, kind: 'service' as const, name: 'Автосервис' }],
  ]),
  masters: new Map(),
  catalog: new Map(),
}

const withToasts = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>

describe('подписи и представление записей', () => {
  test('заголовки записей', () => {
    expect(recordTitle(service({ title: 'ТО-15' }))).toBe('ТО-15')
    expect(recordTitle(fuel({ liters: 42.5 }))).toBe(`Заправка · 42,5${NBSP}л`)
    expect(recordTitle(expense({ category: 'osago' }))).toBe('ОСАГО')
    expect(recordTitle(expense({ category: 'wash', title: 'Мойка у дома' }))).toBe('Мойка у дома')
    expect(recordTitle(odo({}))).toBe('Пробег')
    expect(recordTitle(note({ title: 'Стук справа' }))).toBe('Стук справа')
  })

  test('пустой заголовок — подпись типа', () => {
    expect(recordTitle(service({ title: '  ', serviceType: 'repair' }))).toBe('Ремонт')
    expect(recordTitle(expense({ category: 'wash', title: '' }))).toBe('Мойка')
    expect(recordTitle(note({ title: '' }))).toBe('Заметка')
  })

  test('подзаголовок: пробег и место', () => {
    expect(recordSubtitle(service({ odometer: 148320, placeId: 'pl' }), lookup)).toBe(
      `148${NBSP}320${NBSP}км · Автосервис`,
    )
    expect(recordSubtitle(note({ title: 'x' }), lookup)).toBe('')
  })

  test('подзаголовок: место не нашлось — «Место удалено»; справочник ещё грузится — без места', () => {
    expect(recordSubtitle(fuel({ odometer: 1000, placeId: 'nope' }), lookup)).toBe(
      `1${NBSP}000${NBSP}км · Место удалено`,
    )
    expect(recordSubtitle(fuel({ odometer: 1000, placeId: 'pl' }), undefined)).toBe(`1${NBSP}000${NBSP}км`)
  })

  test('строка журнала: тип, значок, сумма и дата', () => {
    const row = recordRowProps(
      service({ title: 'ТО-6', total: 3890000, date: '2026-09-12', odometer: 145100, placeId: 'pl' }),
      lookup,
      { attachments: 2 },
    )
    expect(row).toMatchObject({
      kind: 'service',
      title: 'ТО-6',
      subtitle: `145${NBSP}100${NBSP}км · Автосервис`,
      amount: `38${NBSP}900${NBSP}₽`,
      date: '12.09.2026',
      attachments: 2,
    })
    expect(row.icon).toBeTruthy()
    const plain = recordRowProps(note({ title: 'Стук' }), lookup)
    expect(plain.amount).toBeUndefined()
    expect(plain.subtitle).toBeUndefined()
  })

  test('подписи: пять видов записей, типы ТО, категории расходов из domain', () => {
    expect(Object.values(RECORD_KIND_LABELS)).toEqual([
      'ТО и ремонт',
      'Заправка',
      'Расход',
      'Пробег',
      'Заметка',
    ])
    expect(Object.keys(RECORD_KIND_ICON)).toEqual(Object.keys(RECORD_KIND_LABELS))
    expect(SERVICE_TYPE_LABELS.maintenance).toBe('ТО')
    expect(EXPENSE_CATEGORY_LABELS).toBe(domainLabels.EXPENSE_CATEGORY_LABELS)
    // Подписи машины — один источник с выгрузкой в Excel.
    expect(TRANSMISSION_LABELS).toBe(domainLabels.TRANSMISSION_LABELS)
    expect(DRIVE_LABELS).toBe(domainLabels.DRIVE_LABELS)
    expect(FUEL_TYPE_LABELS).toBe(domainLabels.FUEL_TYPE_LABELS)
  })
})

describe('справочник для подписей', () => {
  beforeEach(async () => {
    await db.open()
  })
  afterEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })

  test('удалённые места, мастера и позиции каталога остаются в справочнике', async () => {
    const place = await repos.places.create({ kind: 'service', name: 'Автосервис' })
    const master = await repos.masters.create({ name: 'Сергей', placeId: place.id })
    const item = await repos.catalog.create({ name: 'Свой узел', group: 'other', builtin: false })
    await repos.places.remove(place.id)
    await repos.masters.remove(master.id)
    await repos.catalog.remove(item.id)

    const { result } = renderHook(() => useLookup())
    await waitFor(() => expect(result.current).toBeDefined())
    const l = result.current!
    expect(l.places.get(place.id)?.name).toBe('Автосервис')
    expect(l.masters.get(master.id)?.name).toBe('Сергей')
    expect(l.catalog.get(item.id)?.name).toBe('Свой узел')
    expect(l.catalog.get(CATALOG_ID.engineOil)?.name).toBe('Моторное масло')
    expect(recordSubtitle(service({ odometer: 148320, placeId: place.id }), l)).toBe(
      `148${NBSP}320${NBSP}км · Автосервис`,
    )
  })
})

describe('удаление с «Отменить»', () => {
  beforeEach(async () => {
    await db.open()
  })
  afterEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
  })

  test('удаляет, показывает «Запись удалена», «Отменить» возвращает ту же строку', async () => {
    const v = await repos.vehicles.create({
      name: 'Октавия',
      make: 'Skoda',
      model: 'Octavia',
      archived: false,
      fluids: [],
      order: 0,
    })
    const { id: _id, createdAt: _c, updatedAt: _u, ...draft } = note({ vehicleId: v.id, title: 'Стук' })
    const rec = await repos.records.create(draft)
    const { result } = renderHook(() => useSoftDelete(), { wrapper: withToasts })

    await act(() =>
      result.current({
        remove: () => repos.records.remove(rec.id),
        restore: () => repos.records.restore(rec.id),
        text: 'Запись удалена',
      }),
    )
    expect(await repos.records.get(rec.id)).toBeUndefined()
    expect(screen.getByText('Запись удалена')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }))
    await waitFor(async () => expect((await repos.records.get(rec.id))?.id).toBe(rec.id))
    expect(screen.queryByText('Запись удалена')).not.toBeInTheDocument()
  })

  test('уведомление исчезает через 5 секунд', async () => {
    vi.useFakeTimers()
    try {
      const restore = vi.fn(async () => {})
      const { result } = renderHook(() => useSoftDelete(), { wrapper: withToasts })
      await act(() => result.current({ remove: async () => {}, restore, text: 'Запись удалена' }))
      expect(screen.getByText('Запись удалена')).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(4900))
      expect(screen.getByText('Запись удалена')).toBeInTheDocument()
      act(() => vi.advanceTimersByTime(200))
      expect(screen.queryByText('Запись удалена')).not.toBeInTheDocument()
      expect(restore).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  test('сбой удаления — общий русский текст без «Отменить», подробности в консоль', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const restore = vi.fn(async () => {})
    const { result } = renderHook(() => useSoftDelete(), { wrapper: withToasts })
    await act(() =>
      result.current({
        remove: async () => {
          throw new Error('Transaction aborted')
        },
        restore,
        text: 'Запись удалена',
      }),
    )
    expect(screen.getByText('Не получилось удалить — попробуйте ещё раз')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Отменить' })).not.toBeInTheDocument()
    expect(consoleError).toHaveBeenCalled()
  })

  test('UserError при удалении — её текст', async () => {
    const { result } = renderHook(() => useSoftDelete(), { wrapper: withToasts })
    await act(() =>
      result.current({
        remove: async () => {
          throw new UserError('Сначала удалите записи этой машины')
        },
        restore: async () => {},
        text: 'Машина удалена',
      }),
    )
    expect(screen.getByText('Сначала удалите записи этой машины')).toBeInTheDocument()
  })
})

describe('сегодня', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  test('после возврата в приложение на следующий день — новая дата', () => {
    vi.setSystemTime(new Date(2026, 8, 25, 23, 58))
    const { result } = renderHook(() => useToday())
    expect(result.current).toBe('2026-09-25')
    vi.setSystemTime(new Date(2026, 8, 26, 7, 30))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe('2026-09-26')
  })

  test('в открытом приложении дата меняется в полночь (проверка раз в минуту)', () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 25, 23, 59, 30) })
    const { result } = renderHook(() => useToday())
    expect(result.current).toBe('2026-09-25')
    act(() => vi.advanceTimersByTime(60_000))
    expect(result.current).toBe('2026-09-26')
  })
})
