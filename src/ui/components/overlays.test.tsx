import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { useState, type ReactElement } from 'react'
import { IconHome, IconList, IconTool, IconDots, IconGasStation } from '@tabler/icons-react'
import {
  ActionSheet,
  AppBar,
  BottomSheet,
  BottomTabBar,
  Dialog,
  SyncStatusBadge,
  ToastProvider,
  useToast,
  VehicleSwitcher,
} from '../index'

afterEach(cleanup)

test('нижняя панель: 4 вкладки и центральная кнопка', async () => {
  const onAdd = vi.fn()
  const item = (key: string, label: string, icon: ReactElement, active = false) => ({
    key,
    label,
    icon,
    href: `#/${key}`,
    active,
  })
  render(
    <BottomTabBar
      onAdd={onAdd}
      items={[
        item('', 'Главная', <IconHome />, true),
        item('journal', 'Журнал', <IconList />),
        item('reminders', 'ТО', <IconTool />),
        item('more', 'Ещё', <IconDots />),
      ]}
    />,
  )
  expect(screen.getByRole('link', { name: 'Главная' })).toHaveAttribute('aria-current', 'page')
  await userEvent.click(screen.getByRole('button', { name: 'Добавить запись' }))
  expect(onAdd).toHaveBeenCalled()
})

test('шторка закрывается по Escape и возвращает фокус', async () => {
  const onClose = vi.fn()
  render(
    <BottomSheet open title="Тип записи" onClose={onClose}>
      <button>Заправка</button>
    </BottomSheet>,
  )
  expect(screen.getByRole('dialog', { name: 'Тип записи' })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalled()
})

test('шторка: фокус внутри, после закрытия — обратно на кнопку-открывашку', async () => {
  function Wrap() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Открыть</button>
        <BottomSheet open={open} title="Тип записи" onClose={() => setOpen(false)}>
          <button>Заправка</button>
        </BottomSheet>
      </>
    )
  }
  render(<Wrap />)
  const opener = screen.getByRole('button', { name: 'Открыть' })
  await userEvent.click(opener)
  const dialog = screen.getByRole('dialog', { name: 'Тип записи' })
  expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect(dialog.contains(document.activeElement)).toBe(true)
  await userEvent.keyboard('{Escape}')
  expect(opener).toHaveFocus()
})

test('диалог подтверждения удаления', async () => {
  const onConfirm = vi.fn()
  render(<Dialog open title="Удалить запись?" confirmLabel="Удалить" danger onConfirm={onConfirm} onCancel={() => {}} />)
  await userEvent.click(screen.getByRole('button', { name: 'Удалить' }))
  expect(onConfirm).toHaveBeenCalled()
})

test('диалог: Escape — отмена', async () => {
  const onCancel = vi.fn()
  render(<Dialog open title="Удалить запись?" confirmLabel="Удалить" danger onConfirm={() => {}} onCancel={onCancel} />)
  expect(screen.getByRole('alertdialog', { name: 'Удалить запись?' })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(onCancel).toHaveBeenCalled()
})

test('уведомление с «Отменить» исчезает через 5 секунд', async () => {
  vi.useFakeTimers()
  const undo = vi.fn()
  function Trigger() {
    const t = useToast()
    return (
      <button onClick={() => t.show({ text: 'Запись удалена', action: { label: 'Отменить', onClick: undo } })}>
        go
      </button>
    )
  }
  render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  )
  act(() => screen.getByText('go').click())
  expect(screen.getByRole('status')).toHaveTextContent('Запись удалена')
  act(() => screen.getByRole('button', { name: 'Отменить' }).click())
  expect(undo).toHaveBeenCalled()
  act(() => screen.getByText('go').click())
  act(() => vi.advanceTimersByTime(5100))
  expect(screen.queryByText('Запись удалена')).not.toBeInTheDocument()
  vi.useRealTimers()
})

test('значок синхронизации объясняет состояние словами', () => {
  render(<SyncStatusBadge state="error" />)
  expect(screen.getByRole('button', { name: 'Синхронизация: ошибка' })).toBeInTheDocument()
})

test('шапка: заголовок экрана — h1, «Назад» — кнопка', async () => {
  const onBack = vi.fn()
  render(<AppBar title="Запись" onBack={onBack} />)
  expect(screen.getByRole('heading', { level: 1, name: 'Запись' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Назад' }))
  expect(onBack).toHaveBeenCalled()
})

test('выбор типа записи: действие вызывается и шторка закрывается', async () => {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  render(
    <ActionSheet
      open
      title="Новая запись"
      onClose={onClose}
      actions={[{ key: 'fuel', label: 'Заправка', icon: <IconGasStation />, tone: 'fuel', onSelect }]}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Заправка' }))
  expect(onSelect).toHaveBeenCalled()
  expect(onClose).toHaveBeenCalled()
})

test('переключатель машин: активная отмечена, выбор другой', async () => {
  const onSelect = vi.fn()
  render(
    <VehicleSwitcher
      open
      onClose={() => {}}
      activeId="a"
      vehicles={[
        { id: 'a', name: 'Октавия', subtitle: 'Skoda Octavia 2019' },
        { id: 'b', name: 'Нива', subtitle: 'Lada Niva 2021' },
      ]}
      onSelect={onSelect}
      onAdd={() => {}}
      onGarage={() => {}}
    />,
  )
  expect(screen.getByRole('button', { name: /Октавия/ })).toHaveAttribute('aria-current', 'true')
  await userEvent.click(screen.getByRole('button', { name: /Нива/ }))
  expect(onSelect).toHaveBeenCalledWith('b')
})
