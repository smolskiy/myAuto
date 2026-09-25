import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import ShowcasePage from './ShowcasePage'

const SECTIONS = [
  'Токены',
  'Базовые',
  'Списки',
  'Поля',
  'Навигация и оверлеи',
  'Жесты и вложения',
  'Графики',
  'Экраны-эскизы',
]

test('витрина показывает все секции', () => {
  render(<ShowcasePage />)
  expect(screen.getByRole('heading', { level: 1, name: 'Витрина компонентов' })).toBeInTheDocument()
  for (const s of SECTIONS) {
    expect(screen.getByRole('heading', { level: 2, name: s })).toBeInTheDocument()
  }
})

test('режим «обе рядом» — две колонки со своей темой', async () => {
  render(<ShowcasePage />)
  await userEvent.click(screen.getByRole('radio', { name: 'Обе рядом' }))
  const light = screen.getByRole('region', { name: 'Светлая тема' })
  const dark = screen.getByRole('region', { name: 'Тёмная тема' })
  expect(light).toHaveAttribute('data-theme', 'light')
  expect(dark).toHaveAttribute('data-theme', 'dark')
  expect(within(dark).getByRole('heading', { level: 2, name: 'Токены' })).toBeInTheDocument()
})
