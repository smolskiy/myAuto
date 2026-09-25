import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { VehicleCard, VehicleSchematic } from '../index'

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
