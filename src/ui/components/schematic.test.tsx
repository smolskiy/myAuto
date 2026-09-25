import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SchematicPicker, VehicleCard, VehicleSchematic } from '../index'

test('схема — кнопка с именем для скринридера, нажатие уходит наружу', async () => {
  const onClick = vi.fn()
  render(
    <VehicleSchematic
      model="octavia-a5"
      marks={[
        { zone: 'brakes', state: 'overdue', title: 'Тормозная жидкость', detail: 'просрочено на 2 мес' },
      ]}
      label="Схема машины: просрочено — Тормозная жидкость"
      onClick={onClick}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Схема машины: просрочено — Тормозная жидкость' }))
  expect(onClick).toHaveBeenCalled()
})

test('без обработчика схема — картинка', () => {
  render(<VehicleSchematic model="ceed-sw-1" marks={[]} label="Схема машины" />)
  expect(screen.getByRole('img', { name: 'Схема машины' })).toBeInTheDocument()
})

test('выносок не больше двух, остальные зоны — только точки', () => {
  const { container } = render(
    <VehicleSchematic
      model="octavia-a5"
      marks={[
        { zone: 'brakes', state: 'overdue', title: 'Тормозная жидкость', detail: 'просрочено на 2 мес' },
        { zone: 'timing', state: 'soon', title: 'Ремень ГРМ', detail: 'через 2 000 км' },
        { zone: 'wheelFront', state: 'soon', title: 'Передние колодки', detail: 'через 900 км' },
      ]}
      label="Схема машины"
    />,
  )
  expect(screen.getByText('Тормозная жидкость')).toBeInTheDocument()
  expect(screen.getByText('через 2 000 км')).toBeInTheDocument()
  expect(screen.queryByText('Передние колодки')).not.toBeInTheDocument()
  expect(container.querySelectorAll('[data-zone]')).toHaveLength(3)
})

test('легенда — только ненулевые состояния', () => {
  render(
    <VehicleSchematic
      model="octavia-a5"
      marks={[]}
      counts={{ overdue: 0, soon: 2, ok: 7 }}
      label="Схема машины"
    />,
  )
  expect(screen.getByText('Скоро 2')).toBeInTheDocument()
  expect(screen.getByText('В порядке 7')).toBeInTheDocument()
  expect(screen.queryByText(/Просрочено/)).not.toBeInTheDocument()
})

test('карточка машины со схемой не рисует заглушку фото', () => {
  const { container } = render(
    <VehicleCard
      name="Октавия"
      schematic={<VehicleSchematic model="octavia-a5" marks={[]} label="Схема машины" />}
    />,
  )
  expect(screen.getByRole('img', { name: 'Схема машины' })).toBeInTheDocument()
  expect(container.querySelector('svg.tabler-icon-car')).toBeNull()
})

test('выбор чертежа — радиогруппа: подписи, отмеченный вариант, смена', async () => {
  const onChange = vi.fn()
  render(
    <SchematicPicker
      label="Картинка на главной"
      value="auto"
      options={[
        { value: 'auto', label: 'Автоматически', hint: 'Skoda Octavia A5', model: 'octavia-a5' },
        { value: 'lanos', label: 'Daewoo Lanos', model: 'lanos' },
        { value: 'none', label: 'Без картинки' },
      ]}
      onChange={onChange}
    />,
  )
  const group = screen.getByRole('radiogroup', { name: 'Картинка на главной' })
  expect(within(group).getByRole('radio', { name: /Автоматически/ })).toBeChecked()
  await userEvent.click(within(group).getByRole('radio', { name: 'Daewoo Lanos' }))
  expect(onChange).toHaveBeenCalledWith('lanos')
})

test('карточка машины: кнопка «Картинка машины» — выбор картинки', async () => {
  const onPick = vi.fn()
  render(<VehicleCard name="Октавия" onPickSchematic={onPick} />)
  await userEvent.click(screen.getByRole('button', { name: 'Картинка машины' }))
  expect(onPick).toHaveBeenCalled()
})
