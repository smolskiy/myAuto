import type { RecordKindTone } from './types'

export interface ChartColors {
  accent: string
  grid: string
  text: string
  kinds: Record<RecordKindTone, string>
  /** Порядок рядов: акцент, заправки, расходы, заметки, ТО, пробег — соседние оттенки не путаются. */
  series: string[]
}

const KINDS: RecordKindTone[] = ['service', 'fuel', 'expense', 'odometer', 'note']

/** Значения светлой темы из tokens.css — запасные, если CSS ещё не применён (тесты, SSR). */
const LIGHT: ChartColors = {
  accent: '#2563EB',
  grid: '#E5E7EB',
  text: '#646B77',
  kinds: { service: '#4453D6', fuel: '#0B7F72', expense: '#B03A83', odometer: '#56606B', note: '#946200' },
  series: ['#2563EB', '#0B7F72', '#B03A83', '#946200', '#4453D6', '#56606B'],
}

/**
 * Цвета для Recharts. Recharts пишет цвета в SVG-атрибуты, а там `var(--…)` не работает,
 * поэтому значения читаются из вычисленных стилей элемента (по умолчанию <html>; в витрине — колонка темы).
 */
function readFromCss(el: Element = document.documentElement): ChartColors {
  const cs = getComputedStyle(el)
  const read = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback
  const kinds = Object.fromEntries(KINDS.map((k) => [k, read(`--kind-${k}`, LIGHT.kinds[k])])) as Record<
    RecordKindTone,
    string
  >
  const accent = read('--color-accent', LIGHT.accent)
  return {
    accent,
    grid: read('--color-border', LIGHT.grid),
    text: read('--color-text-2', LIGHT.text),
    kinds,
    series: [accent, kinds.fuel, kinds.expense, kinds.note, kinds.service, kinds.odometer],
  }
}

export const chartTheme = { colors: LIGHT, readFromCss }
