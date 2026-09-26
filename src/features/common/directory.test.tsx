import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import type { ID, PlaceKind } from '../../domain/types'
import { ToastProvider } from '../../ui'
import {
  DIRECTORY_CITY_KEY,
  DirectoryCityField,
  PlacePicker,
  setDirectoryCity,
  useDirectory,
  useDirectoryCity,
} from './index'

beforeEach(async () => {
  await db.open()
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
  act(() => setDirectoryCity(undefined))
})

const inApp = (ui: ReactNode) =>
  render(
    <ToastProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ToastProvider>,
  )

function PlaceHarness({
  kinds = ['service', 'tire'],
  allowCreate,
  onChange = () => {},
}: {
  kinds?: PlaceKind[]
  allowCreate?: boolean
  onChange?(id?: ID): void
}) {
  const [value, setValue] = useState<ID | undefined>()
  return (
    <PlacePicker
      label="Место"
      kinds={kinds}
      value={value}
      allowCreate={allowCreate}
      onChange={(id) => {
        setValue(id)
        onChange(id)
      }}
    />
  )
}

const PIKHTIN = 'ПихтинАвто, ул. Нансена, 156А'

describe('город справочника', () => {
  test('выбор хранится на устройстве и сразу виден всем', () => {
    const { result } = renderHook(() => useDirectoryCity())
    expect(result.current).toBeUndefined()
    act(() => setDirectoryCity('evpatoria'))
    expect(result.current).toBe('evpatoria')
    expect(localStorage.getItem(DIRECTORY_CITY_KEY)).toBe('evpatoria')
    act(() => setDirectoryCity(undefined))
    expect(result.current).toBeUndefined()
    expect(localStorage.getItem(DIRECTORY_CITY_KEY)).toBeNull()
  })

  test('чужое значение в хранилище — города нет', () => {
    localStorage.setItem(DIRECTORY_CITY_KEY, 'moscow')
    const { result } = renderHook(() => useDirectoryCity())
    expect(result.current).toBeUndefined()
  })

  test('справочник города грузится по требованию', async () => {
    const { result, rerender } = renderHook(({ city }) => useDirectory(city), {
      initialProps: { city: undefined as 'rostov' | 'evpatoria' | undefined },
    })
    expect(result.current).toBeUndefined()
    rerender({ city: 'evpatoria' })
    await waitFor(() => expect(result.current?.city).toBe('evpatoria'))
    expect(result.current!.places.length).toBeGreaterThan(100)
    // Сменили город — прежний не показываем.
    rerender({ city: 'rostov' })
    expect(result.current?.city).not.toBe('evpatoria')
    await waitFor(() => expect(result.current?.city).toBe('rostov'))
  })

  test('поле «Город» меняет город справочника', async () => {
    inApp(<DirectoryCityField />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Город' }), 'Ростов-на-Дону')
    expect(localStorage.getItem(DIRECTORY_CITY_KEY)).toBe('rostov')
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Город' }), 'Не выбран')
    expect(localStorage.getItem(DIRECTORY_CITY_KEY)).toBeNull()
  })
})

describe('PlacePicker и справочник СТО', () => {
  test('город выбран — СТО из справочника с адресом; выбор заводит своё место с телефоном и ссылкой', async () => {
    act(() => setDirectoryCity('rostov'))
    const onChange = vi.fn()
    inApp(<PlaceHarness onChange={onChange} />)
    await userEvent.type(screen.getByRole('combobox', { name: 'Место' }), 'пихтин нансена')
    await userEvent.click(await screen.findByRole('option', { name: new RegExp(PIKHTIN) }))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.any(String)))
    const place = await repos.places.get(onChange.mock.lastCall![0] as ID)
    expect(place).toMatchObject({
      kind: 'service',
      name: 'ПихтинАвто',
      address: 'ул. Нансена, 156А',
      phone: '+7 (863) 200-77-88',
      url: 'https://yandex.ru/maps/org/pikhtinavto/61146006378/',
    })
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Место' })).toHaveValue('ПихтинАвто'))
  })

  test('шиномонтаж из справочника становится местом вида «шины»', async () => {
    act(() => setDirectoryCity('rostov'))
    const onChange = vi.fn()
    inApp(<PlaceHarness onChange={onChange} />)
    await userEvent.type(screen.getByRole('combobox', { name: 'Место' }), 'Шинный Дом Нансена 219')
    await userEvent.click(await screen.findByRole('option', { name: /Шинный Дом, ул\. Нансена, 219/ }))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(expect.any(String)))
    expect(await repos.places.get(onChange.mock.lastCall![0] as ID)).toMatchObject({ kind: 'tire' })
  })

  test('уже своё место из справочника второй раз не предлагается; «Создать» остаётся', async () => {
    act(() => setDirectoryCity('rostov'))
    await repos.places.create({ kind: 'service', name: 'ПихтинАвто', address: 'ул. Нансена, 156А' })
    inApp(<PlaceHarness />)
    await userEvent.type(screen.getByRole('combobox', { name: 'Место' }), 'пихтин нансена')
    const options = await screen.findAllByRole('option')
    expect(options.some((o) => o.textContent?.includes(PIKHTIN))).toBe(false)
    expect(options.at(-1)).toHaveTextContent('Создать «пихтин нансена»')
  })

  test('без города, для АЗС и в фильтре журнала справочника нет', async () => {
    const { unmount } = inApp(<PlaceHarness />)
    await userEvent.type(screen.getByRole('combobox', { name: 'Место' }), 'пихтин')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Создать «пихтин»'])
    unmount()

    act(() => setDirectoryCity('rostov'))
    const fuel = inApp(<PlaceHarness kinds={['fuel']} />)
    await userEvent.type(screen.getByRole('combobox', { name: 'Место' }), 'пихтин')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Создать «пихтин»'])
    fuel.unmount()

    inApp(<PlaceHarness allowCreate={false} />)
    await userEvent.type(screen.getByRole('combobox', { name: 'Место' }), 'пихтин')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})
