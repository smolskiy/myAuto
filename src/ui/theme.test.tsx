import { act, render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { ThemeProvider, useTheme } from './theme'

function Probe() {
  const t = useTheme()
  return (
    <>
      <span data-testid="resolved">{t.resolved}</span>
      <button onClick={() => t.setPreference('dark')}>dark</button>
      <button onClick={() => t.setPreference('system')}>system</button>
    </>
  )
}

const mockSystem = (dark: boolean) => {
  const listeners: ((e: { matches: boolean }) => void)[] = []
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('dark') ? dark : false,
    media: q,
    addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.push(l),
    removeEventListener: () => {},
  }))
  return (next: boolean) => listeners.forEach((l) => l({ matches: next }))
}

beforeEach(() => {
  localStorage.clear()
  document.head.innerHTML = '<meta name="theme-color" content="#F2F3F5">'
  document.documentElement.removeAttribute('data-theme')
})

test('по умолчанию — как в системе, и следит за её сменой', () => {
  const flip = mockSystem(false)
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )
  expect(screen.getByTestId('resolved').textContent).toBe('light')
  expect(document.documentElement.dataset.theme).toBe('light')
  act(() => flip(true))
  expect(document.documentElement.dataset.theme).toBe('dark')
})

test('ручной выбор сохраняется и меняет theme-color', () => {
  mockSystem(false)
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )
  act(() => screen.getByText('dark').click())
  expect(localStorage.getItem('myauto.theme')).toBe('dark')
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0E0F11')
  act(() => screen.getByText('system').click())
  expect(document.documentElement.dataset.theme).toBe('light')
})

test('сохранённый выбор применяется при запуске, мусор в хранилище — как в системе', () => {
  mockSystem(false)
  localStorage.setItem('myauto.theme', 'dark')
  const { unmount } = render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )
  expect(screen.getByTestId('resolved').textContent).toBe('dark')
  unmount()
  localStorage.setItem('myauto.theme', 'purple')
  render(
    <ThemeProvider>
      <Probe />
    </ThemeProvider>,
  )
  expect(screen.getByTestId('resolved').textContent).toBe('light')
})
