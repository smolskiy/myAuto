import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { BottomSheet, RepeatableList, SearchField, Spinner } from '../index'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('шторка без заголовка тоже закрывается кнопкой «Закрыть»', async () => {
  const onClose = vi.fn()
  render(
    <BottomSheet open onClose={onClose}>
      <p>Содержимое</p>
    </BottomSheet>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
  expect(onClose).toHaveBeenCalled()
})

test('шторка: Tab не уходит на скрытый элемент и не покидает шторку', async () => {
  render(
    <BottomSheet open title="Тип записи" onClose={() => {}}>
      <button>Первая</button>
      <button>Последняя</button>
      <button hidden>Скрытая</button>
    </BottomSheet>,
  )
  screen.getByRole('button', { name: 'Последняя' }).focus()
  await userEvent.tab()
  expect(screen.getByRole('dialog', { name: 'Тип записи' }).contains(document.activeElement)).toBe(true)
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Закрыть' }))
})

test('закрывающаяся шторка (анимация выхода) недоступна: inert', () => {
  const { rerender } = render(
    <BottomSheet open title="Тип записи" onClose={() => {}}>
      <button>Заправка</button>
    </BottomSheet>,
  )
  rerender(
    <BottomSheet open={false} title="Тип записи" onClose={() => {}}>
      <button>Заправка</button>
    </BottomSheet>,
  )
  const layer = screen.getByText('Заправка').closest('[data-state]')!.parentElement!
  expect(layer.closest('[inert]')).not.toBeNull()
})

test('шторка: таймер прокрутки к полю снимается при закрытии', () => {
  vi.useFakeTimers()
  const scroll = vi.fn()
  Element.prototype.scrollIntoView = scroll
  const { rerender } = render(
    <BottomSheet open title="Расход" onClose={() => {}}>
      <input aria-label="Сумма" />
    </BottomSheet>,
  )
  act(() => screen.getByRole('textbox', { name: 'Сумма' }).focus())
  rerender(
    <BottomSheet open={false} title="Расход" onClose={() => {}}>
      <input aria-label="Сумма" />
    </BottomSheet>,
  )
  act(() => vi.advanceTimersByTime(1000))
  expect(scroll).not.toHaveBeenCalled()
})

test('шторка: при «меньше движения» поле прокручивается без анимации', () => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduce'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  const scroll = vi.fn()
  Element.prototype.scrollIntoView = scroll
  render(
    <BottomSheet open title="Расход" onClose={() => {}}>
      <input aria-label="Сумма" />
    </BottomSheet>,
  )
  act(() => screen.getByRole('textbox', { name: 'Сумма' }).focus())
  act(() => vi.advanceTimersByTime(1000))
  expect(scroll).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' })
})

test('поиск: Escape очищает текст и не закрывает шторку вокруг', async () => {
  const outer = vi.fn()
  function Wrap() {
    const [v, setV] = useState('масло')
    return (
      <div onKeyDown={outer}>
        <SearchField value={v} onChange={setV} />
      </div>
    )
  }
  render(<Wrap />)
  const input = screen.getByRole('searchbox', { name: 'Поиск по журналу' })
  input.focus()
  await userEvent.keyboard('{Escape}')
  expect(input).toHaveValue('')
  expect(outer).not.toHaveBeenCalled()
  // Пустой поиск Escape не перехватывает — его получит шторка.
  await userEvent.keyboard('{Escape}')
  expect(outer).toHaveBeenCalledTimes(1)
})

test('спиннер объявляет подпись текстом в живой области', () => {
  render(<Spinner label="Загрузка" />)
  expect(screen.getByRole('status')).toHaveTextContent('Загрузка')
})

test('повторяемый список сохраняет ключи строк: удаление первой не сбрасывает вторую', async () => {
  function Wrap() {
    const [rows, setRows] = useState(['a', 'b'])
    return (
      <>
        <button onClick={() => setRows(rows.slice(1))}>Убрать первую</button>
        <RepeatableList title="Запчасти" addLabel="Добавить" onAdd={() => {}}>
          {rows.map((r) => (
            <input key={r} aria-label={r} defaultValue={r} />
          ))}
        </RepeatableList>
      </>
    )
  }
  render(<Wrap />)
  const b = screen.getByRole('textbox', { name: 'b' })
  fireEvent.change(b, { target: { value: 'b-правка' } })
  await userEvent.click(screen.getByRole('button', { name: 'Убрать первую' }))
  expect(screen.getByRole('textbox', { name: 'b' })).toHaveValue('b-правка')
})
