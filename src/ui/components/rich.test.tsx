import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { IconTrash, IconCopy } from '@tabler/icons-react'
import {
  AttachmentGrid,
  chartTheme,
  LineItemRow,
  PhotoPicker,
  PullToRefresh,
  RepeatableList,
  SwipeRow,
} from '../index'

afterEach(cleanup)

test('свайп-действия доступны без жеста', async () => {
  const onDelete = vi.fn()
  render(
    <SwipeRow
      right={{ label: 'Удалить', icon: <IconTrash />, tone: 'danger', onAction: onDelete }}
      left={{ label: 'Повторить', icon: <IconCopy />, tone: 'accent', onAction: () => {} }}
    >
      <span>Заправка</span>
    </SwipeRow>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Действия' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }))
  expect(onDelete).toHaveBeenCalled()
})

test('выбор фото отдаёт файлы', async () => {
  const onFiles = vi.fn()
  render(<PhotoPicker onFiles={onFiles} />)
  const file = new File(['x'], 'check.jpg', { type: 'image/jpeg' })
  await userEvent.upload(screen.getByLabelText('Добавить фото'), file)
  expect(onFiles).toHaveBeenCalledWith([file])
})

test('подсказка «в прошлый раз» применяется одним нажатием', async () => {
  const onApply = vi.fn()
  render(
    <LineItemRow
      title="Масляный фильтр"
      onEdit={() => {}}
      onRemove={() => {}}
      suggestion={{ text: 'В прошлый раз: Mann W 712/95, 650 ₽', onApply }}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'В прошлый раз: Mann W 712/95, 650 ₽' }))
  expect(onApply).toHaveBeenCalled()
})

/** Протягивает строку указателем на dx по горизонтали. */
function drag(el: Element, dx: number, dy = 0) {
  Object.defineProperty(el, 'offsetWidth', { configurable: true, value: 300 })
  fireEvent.pointerDown(el, { pointerId: 1, clientX: 200, clientY: 100, button: 0 })
  fireEvent.pointerMove(el, { pointerId: 1, clientX: 200 + dx / 2, clientY: 100 + dy / 2 })
  fireEvent.pointerMove(el, { pointerId: 1, clientX: 200 + dx, clientY: 100 + dy })
  fireEvent.pointerUp(el, { pointerId: 1, clientX: 200 + dx, clientY: 100 + dy })
}

test('свайп влево дальше 30 % ширины — правое действие, короче — ничего', () => {
  const onDelete = vi.fn()
  render(
    <SwipeRow right={{ label: 'Удалить', icon: <IconTrash />, tone: 'danger', onAction: onDelete }}>
      <span>Заправка</span>
    </SwipeRow>,
  )
  const content = screen.getByText('Заправка').parentElement!
  drag(content, -60)
  expect(onDelete).not.toHaveBeenCalled()
  drag(content, -120)
  expect(onDelete).toHaveBeenCalledTimes(1)
})

test('вертикальное движение — прокрутка, а не свайп', () => {
  const onDelete = vi.fn()
  render(
    <SwipeRow right={{ label: 'Удалить', icon: <IconTrash />, tone: 'danger', onAction: onDelete }}>
      <span>Заправка</span>
    </SwipeRow>,
  )
  drag(screen.getByText('Заправка').parentElement!, -120, 200)
  expect(onDelete).not.toHaveBeenCalled()
})

test('потянуть вниз на 64 px и больше — обновление со спиннером', async () => {
  let resolve!: () => void
  const onRefresh = vi.fn(() => new Promise<void>((r) => (resolve = r)))
  render(
    <PullToRefresh onRefresh={onRefresh}>
      <p>Лента</p>
    </PullToRefresh>,
  )
  const area = screen.getByText('Лента').closest('[data-pull]')!
  const touch = (y: number) => ({ touches: [{ clientX: 10, clientY: y }] })
  fireEvent.touchStart(area, touch(100))
  fireEvent.touchMove(area, touch(300))
  fireEvent.touchEnd(area, { touches: [] })
  expect(onRefresh).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('status', { name: 'Обновление' })).toBeInTheDocument()
  await act(async () => resolve())
  expect(screen.queryByRole('status', { name: 'Обновление' })).not.toBeInTheDocument()
})

test('вложения: открыть по нажатию, удалить с понятным именем', async () => {
  const onOpen = vi.fn()
  const onRemove = vi.fn()
  render(
    <AttachmentGrid
      items={[
        { id: 'a', url: 'blob:a', kind: 'photo', name: 'чек.jpg' },
        { id: 'b', url: null, kind: 'pdf', name: 'заказ-наряд.pdf', pending: true },
      ]}
      onOpen={onOpen}
      onRemove={onRemove}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Открыть «чек.jpg»' }))
  expect(onOpen).toHaveBeenCalledWith('a')
  await userEvent.click(screen.getByRole('button', { name: 'Удалить «заказ-наряд.pdf»' }))
  expect(onRemove).toHaveBeenCalledWith('b')
  expect(screen.getByText('Не отправлено')).toBeInTheDocument()
})

test('повторяемый список: пусто — текст, кнопка добавления', async () => {
  const onAdd = vi.fn()
  render(
    <RepeatableList title="Запчасти" addLabel="Добавить запчасть" onAdd={onAdd} emptyText="Запчастей нет">
      {null}
    </RepeatableList>,
  )
  expect(screen.getByText('Запчастей нет')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Добавить запчасть' }))
  expect(onAdd).toHaveBeenCalled()
})

test('тема графиков читает цвета из CSS-переменных элемента', () => {
  const el = document.createElement('div')
  el.style.setProperty('--color-accent', '#123456')
  el.style.setProperty('--kind-fuel', '#00AA88')
  document.body.append(el)
  const t = chartTheme.readFromCss(el)
  expect(t.accent).toBe('#123456')
  expect(t.kinds.fuel).toBe('#00AA88')
  expect(t.series[0]).toBe('#123456')
  expect(t.grid).toBe(chartTheme.colors.grid)
  el.remove()
})
