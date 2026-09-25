import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { Button, Chip, ProgressBar, SegmentedControl, StatusPill } from '../index'

afterEach(cleanup)

test('кнопка в состоянии загрузки не нажимается и объявляет занятость', async () => {
  const onClick = vi.fn()
  render(
    <Button loading onClick={onClick}>
      Сохранить
    </Button>,
  )
  const btn = screen.getByRole('button', { name: 'Сохранить' })
  expect(btn).toHaveAttribute('aria-busy', 'true')
  await userEvent.click(btn)
  expect(onClick).not.toHaveBeenCalled()
})

test('статус по умолчанию подписан словами', () => {
  render(
    <>
      <StatusPill state="soon" />
      <StatusPill state="overdue" />
      <StatusPill state="ok" />
    </>,
  )
  expect(screen.getByText('Скоро')).toBeInTheDocument()
  expect(screen.getByText('Просрочено')).toBeInTheDocument()
  expect(screen.getByText('В порядке')).toBeInTheDocument()
})

test('полоска прогресса больше 100 % — полная и доступная', () => {
  render(<ProgressBar value={1.3} label="Масло: пройдено 130 %" />)
  const bar = screen.getByRole('progressbar', { name: 'Масло: пройдено 130 %' })
  expect(bar).toHaveAttribute('aria-valuenow', '100')
})

test('переключатель сегментов — радиогруппа', async () => {
  const onChange = vi.fn()
  render(
    <SegmentedControl
      ariaLabel="Тема"
      value="system"
      onChange={onChange}
      options={[
        { value: 'system', label: 'Как в системе' },
        { value: 'light', label: 'Светлая' },
        { value: 'dark', label: 'Тёмная' },
      ]}
    />,
  )
  expect(screen.getByRole('radio', { name: 'Как в системе' })).toBeChecked()
  await userEvent.click(screen.getByRole('radio', { name: 'Тёмная' }))
  expect(onChange).toHaveBeenCalledWith('dark')
})

test('чип-фильтр с удалением', async () => {
  const onRemove = vi.fn()
  render(
    <Chip selected onRemove={onRemove}>
      Заправки
    </Chip>,
  )
  expect(screen.getByRole('button', { name: 'Заправки' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: 'Убрать фильтр «Заправки»' }))
  expect(onRemove).toHaveBeenCalled()
})

test('сегменты переключаются стрелками, как радиогруппа', async () => {
  const onChange = vi.fn()
  render(
    <SegmentedControl
      ariaLabel="Период"
      value="month"
      onChange={onChange}
      options={[
        { value: 'month', label: 'Месяц' },
        { value: 'year', label: 'Год' },
      ]}
    />,
  )
  screen.getByRole('radio', { name: 'Месяц' }).focus()
  await userEvent.keyboard('{ArrowRight}')
  expect(onChange).toHaveBeenCalledWith('year')
})
