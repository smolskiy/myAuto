import { expect, test } from 'vitest'
import {
  NBSP,
  formatConsumption,
  formatDate,
  formatDaysLeft,
  formatKm,
  formatLiters,
  formatMoney,
  formatMonth,
  pluralize,
} from './format'

const s = (x: string) => x.replaceAll(' ', NBSP)

test('деньги', () => {
  expect(formatMoney(1245000)).toBe(s('12 450 ₽'))
  expect(formatMoney(123456)).toBe(s('1 234,56 ₽'))
  expect(formatMoney(0)).toBe(s('0 ₽'))
  expect(formatMoney(-50000)).toBe(s('−500 ₽'))
})

test('пробег, литры, расход', () => {
  expect(formatKm(148320)).toBe(s('148 320 км'))
  expect(formatLiters(42.5)).toBe(s('42,5 л'))
  expect(formatLiters(40)).toBe(s('40 л'))
  expect(formatConsumption(7.8333)).toBe(s('7,8 л/100 км'))
})

test('даты', () => {
  expect(formatDate('2026-09-12')).toBe('12.09.2026')
  expect(formatDate('2026-09-12', 'long')).toBe(s('12 сентября 2026'))
  expect(formatMonth('2026-09')).toBe(s('Сентябрь 2026'))
})

test('склонения', () => {
  const f: [string, string, string] = ['день', 'дня', 'дней']
  expect([1, 2, 5, 11, 12, 21, 22, 25, 111].map((n) => pluralize(n, f))).toEqual([
    'день',
    'дня',
    'дней',
    'дней',
    'дней',
    'день',
    'дня',
    'дней',
    'дней',
  ])
  expect(formatDaysLeft(12)).toBe(s('12 дней'))
  expect(formatDaysLeft(1)).toBe(s('1 день'))
  expect(formatDaysLeft(0)).toBe('сегодня')
  expect(formatDaysLeft(-3)).toBe(`просрочено на 3${NBSP}дня`)
})
