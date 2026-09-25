import { NBSP, formatDate, formatKm } from '../../domain/format'
import type { ReminderRule } from '../../domain/types'
import type { Lookup } from '../common'

/** Название правила: своё, иначе имя узла, иначе «Напоминание». */
export function ruleTitle(rule: ReminderRule, lookup: Lookup | undefined): string {
  return rule.title?.trim() || (rule.itemId && lookup?.catalog.get(rule.itemId)?.name) || 'Напоминание'
}

/** «каждые 15 000 км · 12 мес.» / «к 01.12.2026». */
export function ruleSummary(rule: ReminderRule): string {
  const every = [
    rule.intervalKm && formatKm(rule.intervalKm),
    rule.intervalMonths && `${rule.intervalMonths}${NBSP}мес.`,
  ]
    .filter(Boolean)
    .join(' · ')
  if (every) return `каждые ${every}`
  return rule.dueDate ? `к ${formatDate(rule.dueDate)}` : ''
}
