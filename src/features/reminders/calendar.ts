import type { UpcomingItem } from '../../domain/calc/reminders'
import { todayISO } from '../../domain/dates'
import { buildIcs, type IcsEvent } from '../../domain/ics'
import type { ISODate } from '../../domain/types'

/** Имя файла календаря для «В календарь». */
export const CALENDAR_FILE_NAME = 'moy-avto-napominaniya.ics'
export const CALENDAR_MIME = 'text/calendar;charset=utf-8'

/** Дата события и пояснение: срок документа, прогноз по пробегу или срок по времени. */
function eventOf(item: UpcomingItem): { date: ISODate; description: string } | null {
  if (item.deadline) return { date: item.deadline.validUntil, description: 'Срок действия' }
  const date = item.predictedDate ?? item.reminder?.dueDate
  if (!date) return null
  // Прогноз раньше срока по времени — значит, дату дал пробег.
  const byKm = item.predictedDate !== undefined && item.predictedDate !== item.reminder?.dueDate
  return { date, description: byKm ? 'Прогноз по пробегу' : 'Срок по времени' }
}

/**
 * Календарь .ics из списка «Скоро»: событие на прогнозную дату, срок по времени или дату окончания документа.
 * Просроченное — на сегодня: событие в прошлом календарь не напомнит. Напоминания без даты не попадают;
 * нечего выгружать — null.
 */
export function remindersToIcs(
  items: UpcomingItem[],
  vehicleName: string,
  now: Date = new Date(),
): string | null {
  const today = todayISO(now)
  const events: IcsEvent[] = []
  for (const item of items) {
    const e = eventOf(item)
    if (!e) continue
    const date = e.date < today ? today : e.date
    events.push({ uid: item.key, title: `${vehicleName}: ${item.title}`, description: e.description, date })
  }
  return events.length > 0 ? buildIcs(events, now) : null
}
