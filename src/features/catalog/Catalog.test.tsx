import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { ensureSeed } from '../../db/seed'
import { BUILTIN_CATALOG, CATALOG_ID } from '../../domain/catalog'
import { NBSP } from '../../domain/format'
import { ToastProvider } from '../../ui'
import { CatalogItemPicker } from '../common'
import CatalogPage from './CatalogPage'

beforeEach(async () => {
  await db.open()
})
afterEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()))
})

function renderCatalog() {
  const router = createMemoryRouter(
    [
      { path: '/catalog', element: <CatalogPage /> },
      { path: '*', element: <p>Другой экран</p> },
    ],
    { initialEntries: ['/catalog'] },
  )
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )
  return router
}

const OIL = 'Моторное масло'

async function openItem(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${name}`) }))
  return screen.findByRole('dialog', { name })
}

describe('каталог узлов', () => {
  test('группы каталога; интервал строкой или «без интервала»', async () => {
    await ensureSeed(db, BUILTIN_CATALOG)
    await repos.catalog.create({ name: 'Антикор', group: 'body', builtin: false })
    renderCatalog()

    const engine = await screen.findByRole('list', { name: 'Двигатель' })
    const oil = within(engine).getByRole('button', { name: new RegExp(`^${OIL}`) })
    expect(oil.textContent).toContain(`каждые 10${NBSP}000${NBSP}км / 12${NBSP}мес.`)
    const body = screen.getByRole('list', { name: 'Кузов' })
    expect(within(body).getByRole('button', { name: /Антикор/ })).toHaveTextContent('без интервала')
  })

  test.each([
    ['встроенный каталог в базе', true],
    ['встроенного узла ещё нет в базе', false],
  ])('скрытие встроенного узла ставит hidden и убирает его из списка (%s)', async (_, seeded) => {
    if (seeded) await ensureSeed(db, BUILTIN_CATALOG)
    renderCatalog()

    const sheet = await openItem(OIL)
    expect(within(sheet).getByRole('textbox', { name: 'Название' })).toHaveAttribute('readonly')
    expect(within(sheet).queryByRole('button', { name: 'Удалить' })).not.toBeInTheDocument()
    await userEvent.click(within(sheet).getByRole('button', { name: 'Скрыть из подсказок' }))

    await waitFor(async () => expect((await repos.catalog.get(CATALOG_ID.engineOil))?.hidden).toBe(true))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: new RegExp(`^${OIL}`) })).not.toBeInTheDocument(),
    )
    expect(await repos.catalog.get(CATALOG_ID.engineOil)).toMatchObject({ builtin: true, name: OIL })
    expect(screen.getByText('Узел скрыт из подсказок')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('switch', { name: 'Показывать скрытые' }))
    const row = await screen.findByRole('button', { name: new RegExp(`^${OIL}`) })
    expect(row).toHaveTextContent('скрыт')
  })

  test('скрытый узел пропадает из подсказок, но его история открывается', async () => {
    await ensureSeed(db, BUILTIN_CATALOG)
    await repos.catalog.update(CATALOG_ID.engineOil, { hidden: true })
    render(
      <ToastProvider>
        <MemoryRouter>
          <CatalogItemPicker onChange={() => {}} />
        </MemoryRouter>
      </ToastProvider>,
    )
    await userEvent.type(screen.getByRole('combobox', { name: 'Узел' }), 'масло')
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(0))
    expect(screen.queryByRole('option', { name: new RegExp(OIL) })).not.toBeInTheDocument()

    cleanup()
    const router = renderCatalog()
    await userEvent.click(await screen.findByRole('switch', { name: 'Показывать скрытые' }))
    const sheet = await openItem(OIL)
    await userEvent.click(within(sheet).getByRole('button', { name: 'Вернуть в подсказки' }))
    await waitFor(async () => expect((await repos.catalog.get(CATALOG_ID.engineOil))?.hidden).toBe(false))

    const again = await openItem(OIL)
    await userEvent.click(within(again).getByRole('button', { name: 'История замен' }))
    expect(router.state.location.pathname).toBe(`/items/${CATALOG_ID.engineOil}`)
  })

  test('свой узел создаётся с builtin: false и интервалами', async () => {
    await ensureSeed(db, BUILTIN_CATALOG)
    renderCatalog()

    await userEvent.click(await screen.findByRole('button', { name: 'Добавить свой узел' }))
    const sheet = await screen.findByRole('dialog', { name: 'Новый узел' })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Сохранить' }))
    expect(within(sheet).getByRole('textbox', { name: 'Название' })).toHaveAccessibleDescription(
      'Добавьте название',
    )

    await userEvent.type(within(sheet).getByRole('textbox', { name: 'Название' }), 'Фильтр салона угольный')
    await userEvent.selectOptions(within(sheet).getByRole('combobox', { name: 'Группа' }), 'Фильтры')
    await userEvent.type(within(sheet).getByRole('textbox', { name: 'Интервал по пробегу' }), '15000')
    await userEvent.type(within(sheet).getByRole('textbox', { name: 'Интервал по времени' }), '12')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Сохранить' }))

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Новый узел' })).not.toBeInTheDocument())
    const custom = (await repos.catalog.list()).find((i) => i.name === 'Фильтр салона угольный')
    expect(custom).toMatchObject({
      builtin: false,
      group: 'filters',
      defaultIntervalKm: 15000,
      defaultIntervalMonths: 12,
    })
    const filters = screen.getByRole('list', { name: 'Фильтры' })
    expect(within(filters).getByRole('button', { name: /Фильтр салона угольный/ })).toBeInTheDocument()
  })

  test('свой узел: правка интервала и удаление с «Отменить»', async () => {
    const custom = await repos.catalog.create({
      name: 'Антикор',
      group: 'body',
      builtin: false,
      defaultIntervalMonths: 24,
    })
    renderCatalog()

    const sheet = await openItem('Антикор')
    expect(within(sheet).queryByRole('button', { name: 'Скрыть из подсказок' })).not.toBeInTheDocument()
    const months = within(sheet).getByRole('textbox', { name: 'Интервал по времени' })
    await userEvent.clear(months)
    await userEvent.type(months, '36')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Сохранить' }))
    await waitFor(async () => expect((await repos.catalog.get(custom.id))?.defaultIntervalMonths).toBe(36))

    const again = await openItem('Антикор')
    await userEvent.click(within(again).getByRole('button', { name: 'Удалить' }))
    await waitFor(async () => expect(await repos.catalog.get(custom.id)).toBeUndefined())
    expect(await screen.findByText('Узел удалён')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }))
    await waitFor(async () => expect(await repos.catalog.get(custom.id)).toBeDefined())
  })
})
