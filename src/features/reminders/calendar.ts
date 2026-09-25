import type { UpcomingItem } from '../../domain/calc/reminders'
import { buildIcs, type IcsEvent } from '../../domain/ics'
import type { ISODate } from '../../domain/types'

/** Имя файла календаря для «В календарь». */
export const CALENDAR_FILE_NAME = 'moy-avto-napominaniya.ics'

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
 * Напоминания без даты не попадают; нечего выгружать — null.
 */
export function remindersToIcs(items: UpcomingItem[], vehicleName: string, now?: Date): string | null {
  const events: IcsEvent[] = []
  for (const item of items) {
    const e = eventOf(item)
    if (!e) continue
    events.push({ uid: item.key, title: `${vehicleName}: ${item.title}`, ...e })
  }
  return events.length > 0 ? buildIcs(events, now) : null
}
