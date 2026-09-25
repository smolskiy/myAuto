import { expect, test } from 'vitest'

// Договорённости, которые живут только в CSS (jsdom его не применяет): читаем файлы как текст.
const fsModule = 'node:fs'
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
  readFileSync(path: string, encoding: 'utf8'): string
}
const css = (path: string) => readFileSync(`src/ui/${path}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Тело первого правила с этим селектором. */
function rule(source: string, selector: string): string {
  const i = source.indexOf(`${selector} {`)
  if (i < 0) throw new Error(`нет правила ${selector}`)
  return source.slice(source.indexOf('{', i) + 1, source.indexOf('}', i))
}

test('уведомление: отступ снизу — переменная --toast-offset (по умолчанию высота нижней панели)', () => {
  expect(rule(css('components/Toast/Toast.module.css'), '.region')).toMatch(
    /bottom:\s*calc\(var\(--toast-offset\)/,
  )
  expect(css('tokens.css')).toMatch(/--toast-offset:\s*var\(--tabbar-height\);/)
})

test('крестик чипа: область касания 44×44', () => {
  const after = rule(css('components/Chip/Chip.module.css'), '.remove::after')
  // Кнопка 28 px, область расширена на (44 − 28) / 2 с каждой стороны.
  expect(rule(css('components/Chip/Chip.module.css'), '.remove')).toMatch(
    /width:\s*28px;[\s\S]*height:\s*28px;/,
  )
  expect(after).toMatch(/inset:\s*calc\(\(var\(--tap\) - 28px\) \/ -2\);/)
})

test('нижняя панель: стили вкладки на любом элементе из renderLink, не только на <a>', () => {
  const source = css('components/BottomTabBar/BottomTabBar.module.css')
  expect(source).toContain('.tab > * {')
  expect(source).not.toMatch(/\.tab[^{]*>\s*a\b/)
})

test('активный пункт комбобокса отмечен рамкой акцента 2 px внутрь', () => {
  expect(rule(css('components/Combobox/Combobox.module.css'), '.active')).toMatch(
    /box-shadow:\s*inset 0 0 0 var\(--focus-width\) var\(--color-accent\);/,
  )
})
