import { todayISO } from '../../domain/dates'
import { NBSP, formatDate, formatNumber, pluralize } from '../../domain/format'
import type { SyncStatus } from '../../sync/contracts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const MINUTE_FORMS: [string, string, string] = ['минуту', 'минуты', 'минут']
const HOUR_FORMS: [string, string, string] = ['час', 'часа', 'часов']

const two = (n: number) => String(n).padStart(2, '0')

/** «только что» / «5 минут назад» / «3 часа назад» / «20.09.2026 в 09:05» — по местному времени. */
export function agoText(ts: number, now: number): string {
  const diff = Math.max(0, now - ts)
  if (diff < MINUTE) return 'только что'
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE)
    return `${formatNumber(m)}${NBSP}${pluralize(m, MINUTE_FORMS)} назад`
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR)
    return `${formatNumber(h)}${NBSP}${pluralize(h, HOUR_FORMS)} назад`
  }
  const d = new Date(ts)
  return `${formatDate(todayISO(d))} в ${two(d.getHours())}:${two(d.getMinutes())}`
}

/** Состояние синхронизации словами — для экрана «Синхронизация» и подсказки значка. */
export function syncStateText(status: SyncStatus, now: number): string {
  switch (status.state) {
    case 'off':
      return 'Не подключено'
    case 'syncing':
      return 'Синхронизация…'
    case 'offline':
      return 'Нет сети — изменения уйдут позже'
    case 'error':
      return status.error || 'Синхронизация не удалась'
    case 'idle':
      return status.lastSyncAt ? `Синхронизировано ${agoText(status.lastSyncAt, now)}` : 'Подключено'
  }
}
