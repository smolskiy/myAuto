import { describe, expect, test } from 'vitest'
import { chartTheme } from './chartTheme'
import { contrastRatio as contrast } from './lib/contrast'
import { THEME_BG } from './theme'

// `?raw` для .css Vitest подменяет пустой строкой, поэтому читаем файлы напрямую (cwd — корень проекта).
// Типы Node в src/ не подключены (tsconfig.json), поэтому модуль берём динамически по имени.
const fsModule = 'node:fs'
const { readFileSync } = (await import(/* @vite-ignore */ fsModule)) as {
  readFileSync(path: string, encoding: 'utf8'): string
}
const tokensCss = readFileSync('src/ui/tokens.css', 'utf8')
const indexHtml = readFileSync('index.html', 'utf8')

type ThemeName = 'light' | 'dark'

/** Достаёт `--имя: значение` из блоков `:root` (светлая) и `[data-theme="dark"]` (тёмная). */
function readTokens(css: string): Record<ThemeName, Record<string, string>> {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: Record<ThemeName, Record<string, string>> = { light: {}, dark: {} }
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1]!.trim()
    const theme: ThemeName | null = /\[data-theme=["']dark["']\]/.test(selector)
      ? 'dark'
      : selector.includes(':root')
        ? 'light'
        : null
    if (!theme) continue
    // Prettier пишет hex строчными; сравниваем в одном регистре.
    for (const d of m[2]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      const value = d[2]!.trim()
      out[theme][d[1]!] = /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : value
    }
  }
  return out
}

const TEXT = 4.5
const UI = 3

/** [текст/значок, фон, порог]. Текст — 4.5, значки, полоски, рамки полей и фокус — 3. */
const PAIRS: [string, string, number][] = [
  ['--color-text', '--color-bg', TEXT],
  ['--color-text', '--color-surface', TEXT],
  ['--color-text', '--color-surface-2', TEXT],
  ['--color-text-2', '--color-bg', TEXT],
  ['--color-text-2', '--color-surface', TEXT],
  ['--color-text-2', '--color-surface-2', TEXT],
  ['--color-accent', '--color-bg', TEXT],
  ['--color-accent', '--color-surface', TEXT],
  ['--color-accent', '--color-surface-2', TEXT],
  ['--color-accent', '--color-accent-soft', TEXT],
  ['--color-on-accent', '--color-accent-fill', TEXT],
  ['--color-on-accent', '--color-accent-pressed', TEXT],
  ['--color-accent-fill', '--color-surface', UI],
  ['--color-accent-fill', '--color-bg', UI],
  ['--color-accent', '--color-bg', UI],
  ['--color-border-strong', '--color-surface', UI],
  ['--color-ok', '--color-surface', TEXT],
  ['--color-ok', '--color-ok-soft', TEXT],
  ['--color-soon', '--color-surface', TEXT],
  ['--color-soon', '--color-soon-soft', TEXT],
  ['--color-overdue', '--color-surface', TEXT],
  ['--color-overdue', '--color-overdue-soft', TEXT],
  ['--color-overdue', '--color-bg', TEXT],
  ['--color-ok', '--color-track', UI],
  ['--color-soon', '--color-track', UI],
  ['--color-overdue', '--color-track', UI],
  ['--color-accent', '--color-track', UI],
  ['--color-on-inverse', '--color-inverse-surface', TEXT],
  ['--color-inverse-accent', '--color-inverse-surface', TEXT],
  ...(['service', 'fuel', 'expense', 'odometer', 'note'] as const).flatMap(
    (k): [string, string, number][] => [
      [`--kind-${k}`, `--kind-${k}-soft`, UI],
      [`--kind-${k}`, '--color-surface', UI],
    ],
  ),
]

const tokens = readTokens(tokensCss)

describe.each(['light', 'dark'] as const)('контраст, тема %s', (theme) => {
  test.each(PAIRS)('%s на %s ≥ %s', (fg, bg, min) => {
    const t = tokens[theme]
    expect(t[fg], `${fg} не задан`).toBeDefined()
    expect(t[bg], `${bg} не задан`).toBeDefined()
    expect(contrast(t[fg]!, t[bg]!)).toBeGreaterThanOrEqual(min)
  })
})

test('обе темы задают одинаковый набор токенов-цветов', () => {
  const colorKeys = (t: Record<string, string>) =>
    Object.keys(t)
      .filter((k) => k.startsWith('--color-') || k.startsWith('--kind-'))
      .sort()
  expect(colorKeys(tokens.dark)).toEqual(colorKeys(tokens.light))
})

test('фон темы един для CSS, theme-color и скрипта в index.html', () => {
  expect(tokens.light['--color-bg']).toBe(THEME_BG.light)
  expect(tokens.dark['--color-bg']).toBe(THEME_BG.dark)
  expect(indexHtml).toContain(THEME_BG.light)
  expect(indexHtml).toContain(THEME_BG.dark)
})

test('запасные цвета графиков совпадают со светлой темой', () => {
  const t = tokens.light
  expect(chartTheme.colors.accent).toBe(t['--color-accent'])
  expect(chartTheme.colors.grid).toBe(t['--color-border'])
  expect(chartTheme.colors.text).toBe(t['--color-text-2'])
  for (const [kind, color] of Object.entries(chartTheme.colors.kinds)) expect(color).toBe(t[`--kind-${kind}`])
})
