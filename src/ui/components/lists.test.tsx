import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { IconTool } from '@tabler/icons-react'
import { ListItem, RecordRow, ReminderCard, VehicleCard } from '../index'

test('строка журнала: длинный заголовок обрезается, сумма остаётся видимой', () => {
  const long = 'Замена ремня ГРМ с роликами и помпой в автосервисе на Профсоюзной улице дом 128'
  render(
    <RecordRow
      kind="service"
      icon={<IconTool />}
      title={long}
      subtitle="145 100 км · Автосервис"
      amount="12 450 ₽"
    />,
  )
  const title = screen.getByText(long)
  expect(title).toHaveAttribute('title', long)
  expect(title.className).toMatch(/truncate/)
  expect(screen.getByText('12 450 ₽')).toBeVisible()
})

test('строка-ссылка кликабельна и доступна с клавиатуры', async () => {
  const onClick = vi.fn()
  render(<ListItem title="Места и мастера" chevron onClick={onClick} />)
  screen.getByRole('button', { name: /Места и мастера/ }).focus()
  await userEvent.keyboard('{Enter}')
  expect(onClick).toHaveBeenCalled()
})

test('карточка напоминания: две полоски и статус словами', () => {
  render(
    <ReminderCard
      title="Моторное масло"
      state="soon"
      kmText="через 800 км"
      timeText="через 112 дней"
      progressKm={0.92}
      progressTime={0.69}
    />,
  )
  expect(screen.getByText('Скоро')).toBeInTheDocument()
  expect(screen.getAllByRole('progressbar')).toHaveLength(2)
  expect(screen.getByRole('progressbar', { name: 'Моторное масло: по пробегу 92 %' })).toBeInTheDocument()
})

test('карточка машины: переключатель машин — кнопка', async () => {
  const onSwitch = vi.fn()
  render(<VehicleCard name="Октавия" plate="А123ВС 77" odometer="148 320 км" onSwitch={onSwitch} />)
  await userEvent.click(screen.getByRole('button', { name: 'Октавия, сменить машину' }))
  expect(onSwitch).toHaveBeenCalled()
})

test('строка-ссылка с href — это ссылка, а не кнопка', () => {
  render(<ListItem title="Статистика" href="#/stats" chevron />)
  expect(screen.getByRole('link', { name: /Статистика/ })).toHaveAttribute('href', '#/stats')
  expect(screen.getByRole('link', { name: /Статистика/ })).not.toHaveAttribute('target')
})

test('внешняя строка-ссылка открывается в новой вкладке', () => {
  render(<ListItem title="Открыть на карте" href="https://yandex.ru/maps/org/x/1/" external />)
  const link = screen.getByRole('link', { name: 'Открыть на карте' })
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noreferrer')
})

test('строка журнала с обработчиком — кнопка с понятным именем', async () => {
  const onClick = vi.fn()
  render(
    <RecordRow
      kind="fuel"
      icon={<IconTool />}
      title="Заправка"
      subtitle="АИ-95 · 42 л"
      amount="2 450 ₽"
      date="12 сен"
      onClick={onClick}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: /Заправка/ }))
  expect(onClick).toHaveBeenCalled()
})
