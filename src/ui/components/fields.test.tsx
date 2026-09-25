import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { Combobox, DateField, MoneyField, NumberField, OdometerField, Rating, SearchField, Switch } from '../index'

afterEach(cleanup)

test('сумма понимает выражение и отдаёт копейки', async () => {
  const onChange = vi.fn()
  render(<MoneyField label="Сумма" value={undefined} onChange={onChange} />)
  const input = screen.getByRole('textbox', { name: 'Сумма' })
  expect(input).toHaveAttribute('inputmode', 'decimal')
  await userEvent.type(input, '1200+650')
  expect(screen.getByText('= 1 850 ₽')).toBeInTheDocument()
  await userEvent.tab()
  expect(onChange).toHaveBeenLastCalledWith(185000)
  expect(input).toHaveValue('1\u00A0850')
})

test('некорректная сумма — сообщение, значение не меняется', async () => {
  const onChange = vi.fn()
  render(<MoneyField label="Сумма" value={undefined} onChange={onChange} />)
  await userEvent.type(screen.getByRole('textbox', { name: 'Сумма' }), '12++')
  await userEvent.tab()
  expect(screen.getByText('Не получилось посчитать сумму')).toBeInTheDocument()
  expect(onChange).not.toHaveBeenCalledWith(expect.any(Number))
})

test('быстрые кнопки прибавляют рубли', async () => {
  function Wrap() {
    const [v, setV] = useState<number | undefined>(100000)
    return <MoneyField label="Сумма" value={v} onChange={setV} quickAdd={[500]} />
  }
  render(<Wrap />)
  await userEvent.click(screen.getByRole('button', { name: '+500' }))
  expect(screen.getByRole('textbox', { name: 'Сумма' })).toHaveValue('1\u00A0500')
})

test('число с единицей и запятой', async () => {
  const onChange = vi.fn()
  render(<NumberField label="Литры" unit="л" decimals={2} value={undefined} onChange={onChange} />)
  await userEvent.type(screen.getByRole('textbox', { name: 'Литры' }), '42,5')
  expect(onChange).toHaveBeenLastCalledWith(42.5)
  expect(screen.getByText('л')).toBeInTheDocument()
})

test('дата: чипы «Сегодня» и «Вчера»', async () => {
  const onChange = vi.fn()
  render(<DateField label="Дата" value="2026-09-01" today="2026-09-25" quick onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Вчера' }))
  expect(onChange).toHaveBeenCalledWith('2026-09-24')
})

function ComboWrap(props: {
  options: (q: string) => { id: string; label: string }[]
  onSelect(): void
  onCreate(l: string): void
}) {
  const [q, setQ] = useState('')
  return (
    <Combobox
      label="Место"
      value={null}
      query={q}
      onQueryChange={setQ}
      onSelect={props.onSelect}
      onCreate={props.onCreate}
      options={props.options(q)}
    />
  )
}

test('комбобокс: выбор подсказки с клавиатуры', async () => {
  const onSelect = vi.fn()
  render(
    <ComboWrap
      options={(q) => (q ? [{ id: 'p1', label: 'Автосервис на Ленина' }] : [])}
      onSelect={onSelect}
      onCreate={() => {}}
    />,
  )
  await userEvent.type(screen.getByRole('combobox', { name: 'Место' }), 'Авто')
  expect(screen.getByRole('option', { name: 'Автосервис на Ленина' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Создать «Авто»' })).toBeInTheDocument()
  await userEvent.keyboard('{ArrowDown}{Enter}')
  expect(onSelect).toHaveBeenCalledWith({ id: 'p1', label: 'Автосервис на Ленина' })
})

test('комбобокс: создание нового, когда подсказок нет', async () => {
  const onCreate = vi.fn()
  render(<ComboWrap options={() => []} onSelect={() => {}} onCreate={onCreate} />)
  await userEvent.type(screen.getByRole('combobox', { name: 'Место' }), 'Новое место')
  await userEvent.keyboard('{ArrowDown}{Enter}')
  expect(onCreate).toHaveBeenCalledWith('Новое место')
})

test('комбобокс: Escape закрывает список, активный пункт объявляется', async () => {
  render(
    <ComboWrap options={() => [{ id: 'a', label: 'Автосервис' }]} onSelect={() => {}} onCreate={() => {}} />,
  )
  const input = screen.getByRole('combobox', { name: 'Место' })
  await userEvent.type(input, 'А')
  expect(input).toHaveAttribute('aria-expanded', 'true')
  await userEvent.keyboard('{ArrowDown}')
  const active = input.getAttribute('aria-activedescendant')
  expect(active && document.getElementById(active)).toHaveTextContent('Автосервис')
  await userEvent.keyboard('{Escape}')
  expect(input).toHaveAttribute('aria-expanded', 'false')
})

test('пробег: последний известный — подсказка, нарушение хронологии — предупреждение', () => {
  render(
    <OdometerField
      value={140000}
      onChange={() => {}}
      lastKnown="последний: 148 320 км"
      warning="Меньше, чем в записи от 12.09.2026"
    />,
  )
  const input = screen.getByRole('textbox', { name: 'Пробег' })
  expect(input).toHaveValue('140\u00A0000')
  expect(input).toHaveAccessibleDescription(/последний: 148 320 км/)
  expect(input).toHaveAccessibleDescription(/Меньше, чем в записи от 12\.09\.2026/)
})

test('переключатель — роль switch', async () => {
  const onChange = vi.fn()
  render(<Switch label="Полный бак" checked onChange={onChange} />)
  await userEvent.click(screen.getByRole('switch', { name: 'Полный бак' }))
  expect(onChange).toHaveBeenCalledWith(false)
})

test('оценка — радиогруппа из пяти звёзд, повторное нажатие снимает', async () => {
  const onChange = vi.fn()
  render(<Rating label="Оценка мастера" value={4} onChange={onChange} />)
  expect(screen.getByRole('radiogroup', { name: 'Оценка мастера' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: '4 из 5' })).toBeChecked()
  await userEvent.click(screen.getByRole('radio', { name: '5 из 5' }))
  expect(onChange).toHaveBeenLastCalledWith(5)
  await userEvent.click(screen.getByRole('radio', { name: '4 из 5' }))
  expect(onChange).toHaveBeenLastCalledWith(undefined)
})

test('поиск очищается кнопкой', async () => {
  const onChange = vi.fn()
  render(<SearchField value="масло" onChange={onChange} />)
  expect(screen.getByRole('searchbox', { name: 'Поиск по журналу' })).toHaveValue('масло')
  await userEvent.click(screen.getByRole('button', { name: 'Очистить поиск' }))
  expect(onChange).toHaveBeenCalledWith('')
})
