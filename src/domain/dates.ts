import type { ISODate } from './types'

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Проверяет и формат, и существование даты (например, 2026-02-30 — false). */
export function isISODate(s: string): boolean {
  const m = ISO_RE.exec(s)
  if (!m) return false
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

/** Сегодняшняя дата в локальном часовом поясе устройства. */
export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear()
  const mo = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

function toUTCDate(d: ISODate): Date {
  const [y, mo, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y!, mo! - 1, day!))
}

function fromUTCDate(date: Date): ISODate {
  const y = date.getUTCFullYear()
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

export function addDays(d: ISODate, n: number): ISODate {
  const date = toUTCDate(d)
  date.setUTCDate(date.getUTCDate() + n)
  return fromUTCDate(date)
}

/** Зажимает день до последнего дня целевого месяца (31 янв + 1 мес = 28/29 фев). */
export function addMonths(d: ISODate, n: number): ISODate {
  const [y, mo, day] = d.split('-').map(Number)
  const targetIndex = mo! - 1 + n
  const targetYear = y! + Math.floor(targetIndex / 12)
  const targetMonth = ((targetIndex % 12) + 12) % 12
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const clampedDay = Math.min(day!, daysInTargetMonth)
  return fromUTCDate(new Date(Date.UTC(targetYear, targetMonth, clampedDay)))
}

export function diffDays(from: ISODate, to: ISODate): number {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((toUTCDate(to).getTime() - toUTCDate(from).getTime()) / msPerDay)
}

export function monthKey(d: ISODate): string {
  return d.slice(0, 7)
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0
}
