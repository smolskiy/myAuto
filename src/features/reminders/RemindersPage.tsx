import { IconBellPlus, IconCalendarPlus, IconPlus } from '@tabler/icons-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useDeadlines, useReminderRules, useReminderStatuses } from '../../db/hooks'
import { upcoming, type ReminderState, type UpcomingItem } from '../../domain/calc/reminders'
import { NBSP, formatDate, formatKm } from '../../domain/format'
import type { ReminderRule, Vehicle } from '../../domain/types'
import { saveFile } from '../../sync/saveFile'
import { Button, EmptyState, ListGroup, ListItem, ReminderCard, useToast } from '../../ui'
import { Page, VehicleGate, useLookup, useToday, type Lookup } from '../common'
import { reminderCardProps } from '../home/reminderText'
import { CALENDAR_FILE_NAME, remindersToIcs } from './calendar'
import styles from './RemindersPage.module.css'

const GROUPS: { state: ReminderState; title: string }[] = [
  { state: 'overdue', title: 'Просрочено' },
  { state: 'soon', title: 'Скоро' },
  { state: 'ok', title: 'В порядке' },
  { state: 'unknown', title: 'Нет данных' },
]

/** Куда ведёт карточка: правило — в форму, срок документа — в документ, срок из расхода — в запись. */
function itemPath(item: UpcomingItem): string {
  if (item.reminder) return `/reminders/${item.reminder.ruleId}`
  const source = item.deadline!.source
  return source.type === 'document' ? `/documents/${source.id}` : `/record/${source.id}`
}

function ruleTitle(rule: ReminderRule, lookup: Lookup | undefined): string {
  return rule.title?.trim() || (rule.itemId && lookup?.catalog.get(rule.itemId)?.name) || 'Напоминание'
}

/** «каждые 15 000 км · 12 мес.» / «к 01.12.2026». */
function ruleSummary(rule: ReminderRule): string {
  const every = [
    rule.intervalKm && formatKm(rule.intervalKm),
    rule.intervalMonths && `${rule.intervalMonths}${NBSP}мес.`,
  ]
    .filter(Boolean)
    .join(' · ')
  if (every) return `каждые ${every}`
  return rule.dueDate ? `к ${formatDate(rule.dueDate)}` : ''
}

function RemindersContent({ vehicle }: { vehicle: Vehicle }) {
  const navigate = useNavigate()
  const toast = useToast()
  const today = useToday()
  const statuses = useReminderStatuses(vehicle.id, today)
  const deadlines = useDeadlines(vehicle.id, today)
  const rules = useReminderRules(vehicle.id)
  const lookup = useLookup()
  const items = useMemo(
    () => (statuses && deadlines ? upcoming(statuses, deadlines) : undefined),
    [statuses, deadlines],
  )
  if (!items || !rules) return null

  const go = (path: string) => void navigate(path)
  const disabled = rules.filter((r) => !r.enabled)

  const exportCalendar = async () => {
    const ics = remindersToIcs(items, vehicle.name)
    if (!ics) {
      toast.show({ text: 'Нет дат для календаря' })
      return
    }
    try {
      await saveFile(new Blob([ics], { type: 'text/calendar' }), CALENDAR_FILE_NAME)
    } catch (e) {
      console.warn('Календарь не сохранился', e)
      toast.show({ text: 'Не удалось сохранить файл календаря' })
    }
  }

  if (items.length === 0 && disabled.length === 0) {
    return (
      <EmptyState
        icon={<IconBellPlus />}
        title="Напоминаний пока нет"
        text="Добавьте замену масла, фильтров или срок страховки — подскажем, когда пора."
        action={
          <Button icon={<IconPlus />} onClick={() => go('/reminders/new')}>
            Добавить напоминание
          </Button>
        }
      />
    )
  }

  return (
    <>
      {GROUPS.map(({ state, title }) => {
        const group = items.filter((i) => i.state === state)
        if (group.length === 0) return null
        return (
          <ListGroup key={state} title={title}>
            {group.map((item) => {
              const card = (
                <ReminderCard
                  key={item.key}
                  {...reminderCardProps(item, today)}
                  onClick={() => go(itemPath(item))}
                />
              )
              if (state !== 'unknown') return card
              return (
                <div key={item.key} className={styles.unknown}>
                  {card}
                  <div className={styles.unknownAction}>
                    <Button size="sm" variant="secondary" onClick={() => go(itemPath(item))}>
                      Указать, когда делали
                    </Button>
                  </div>
                </div>
              )
            })}
          </ListGroup>
        )
      })}
      {disabled.length > 0 && (
        <ListGroup title="Выключены">
          {disabled.map((rule) => (
            <ListItem
              key={rule.id}
              title={ruleTitle(rule, lookup)}
              subtitle={ruleSummary(rule) || undefined}
              chevron
              onClick={() => go(`/reminders/${rule.id}`)}
            />
          ))}
        </ListGroup>
      )}
      <div className={styles.actions}>
        <Button block icon={<IconPlus />} onClick={() => go('/reminders/new')}>
          Добавить напоминание
        </Button>
        {items.length > 0 && (
          <Button block variant="secondary" icon={<IconCalendarPlus />} onClick={() => void exportCalendar()}>
            В календарь
          </Button>
        )}
      </div>
    </>
  )
}

export default function RemindersPage() {
  return (
    <Page title="ТО и напоминания" large>
      <VehicleGate>{(vehicle) => <RemindersContent vehicle={vehicle} />}</VehicleGate>
    </Page>
  )
}
