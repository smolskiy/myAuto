import type { UpcomingItem } from '../../domain/calc/reminders'
import { NBSP, formatDate, formatDaysLeft, formatKm } from '../../domain/format'
import type { ISODate } from '../../domain/types'
import type { ReminderCardProps } from '../../ui'

/** «через 1 200 км» / «просрочено на 300 км»; ровно на сроке — «сейчас». */
function kmText(km: number): string {
  if (km > 0) return `через ${formatKm(km)}`
  if (km < 0) return `просрочено на ${formatKm(-km)}`
  return 'сейчас'
}

/** «через 112 дней» / «просрочено на 3 дня» / «сегодня». */
function timeText(days: number): string {
  return days > 0 ? `через ${formatDaysLeft(days)}` : formatDaysLeft(days)
}

/** «≈ 19 октября»; другой год — «≈ 10 января 2027». */
function predictedText(date: ISODate, today: ISODate): string {
  const long = formatDate(date, 'long')
  const year = date.slice(0, 4)
  const text = year === today.slice(0, 4) ? long.slice(0, -(year.length + 1)) : long
  return `≈${NBSP}${text}`
}

/** Пропсы ReminderCard из элемента списка «Скоро» — для главной и экрана ТО. */
export function reminderCardProps(item: UpcomingItem, today: ISODate): ReminderCardProps {
  const props: ReminderCardProps = { title: item.title, state: item.state }
  if (item.remainingKm !== undefined) props.kmText = kmText(item.remainingKm)
  if (item.remainingDays !== undefined) props.timeText = timeText(item.remainingDays)
  if (item.predictedDate) props.predicted = predictedText(item.predictedDate, today)

  const r = item.reminder
  if (r?.progressKm !== undefined) props.progressKm = r.progressKm
  if (r?.progressTime !== undefined) props.progressTime = r.progressTime
  if (r?.last) {
    const odo = r.last.odometer !== undefined ? `, ${formatKm(r.last.odometer)}` : ''
    props.lastText = `последняя: ${formatDate(r.last.date)}${odo}`
  }
  if (item.deadline) props.lastText = `действует до ${formatDate(item.deadline.validUntil)}`
  return props
}
