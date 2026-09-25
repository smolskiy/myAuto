import { IconBellPlus, IconHistory } from '@tabler/icons-react'
import { useNavigate, useParams } from 'react-router'
import { useItemHistory, useReminderRules } from '../../db/hooks'
import type { ItemHistoryEntry } from '../../domain/calc/itemHistory'
import { NBSP, formatDate, formatKm, formatMoney, formatNumber, pluralize } from '../../domain/format'
import type { ID, ISODate, Kopecks, Vehicle } from '../../domain/types'
import { Card, EmptyState, Icon, ListGroup, ListItem } from '../../ui'
import { MISSING_PLACE, Page, VehicleGate, useLookup, type Lookup } from '../common'
import styles from './ItemHistoryPage.module.css'
import { ruleSummary } from './ruleText'

/** Одна замена — одна запись ТО (в ней может быть и запчасть, и работа по узлу). */
interface Replacement {
  recordId: ID
  date: ISODate
  odometer?: number
  placeId?: ID
  sinceKm?: number
  sinceDays?: number
  title: string
  price?: Kopecks
}

const DAYS_PER_MONTH = 30.4375

const partLabel = (e: ItemHistoryEntry) => [e.brand, e.partNumber].filter(Boolean).join(' · ') || e.name

/** Строки истории → замены по записям, в том же порядке (новые сверху). */
function toReplacements(entries: ItemHistoryEntry[]): Replacement[] {
  const byRecord = new Map<ID, ItemHistoryEntry[]>()
  for (const e of entries) byRecord.set(e.recordId, [...(byRecord.get(e.recordId) ?? []), e])
  return [...byRecord.values()].map((lines) => {
    const first = lines[0]!
    const parts = lines.filter((l) => l.line === 'part')
    const priced = lines.filter((l) => l.price !== undefined)
    return {
      recordId: first.recordId,
      date: first.date,
      odometer: first.odometer,
      placeId: first.placeId,
      sinceKm: first.sinceKm,
      sinceDays: first.sinceDays,
      title: (parts.length > 0 ? parts.map(partLabel) : lines.map((l) => l.name)).join(', '),
      price: priced.length > 0 ? priced.reduce((s, l) => s + l.price!, 0) : undefined,
    }
  })
}

/** «273 дня» — без «через» и «сегодня», которые добавляет formatDaysLeft. */
const daysText = (n: number) => `${formatNumber(n)}${NBSP}${pluralize(n, ['день', 'дня', 'дней'])}`

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

/** «В среднем каждые 9 800 км / 11 мес.»; интервалов нет — null. */
function averageText(reps: Replacement[]): string | null {
  const kms = reps.flatMap((r) => (r.sinceKm !== undefined ? [r.sinceKm] : []))
  const days = reps.flatMap((r) => (r.sinceDays !== undefined ? [r.sinceDays] : []))
  const parts: string[] = []
  if (kms.length > 0) parts.push(formatKm(Math.round(mean(kms) / 100) * 100))
  if (days.length > 0) {
    const months = Math.round(mean(days) / DAYS_PER_MONTH)
    parts.push(months >= 1 ? `${months}${NBSP}мес.` : daysText(Math.round(mean(days))))
  }
  return parts.length > 0 ? `В среднем каждые ${parts.join(' / ')}` : null
}

/** Самый частый бренд запчастей; при равенстве — из более новой замены. */
function topBrand(entries: ItemHistoryEntry[]): string | null {
  const counts = new Map<string, number>()
  let best: string | null = null
  for (const e of entries) {
    const brand = e.line === 'part' ? e.brand?.trim() : undefined
    if (!brand) continue
    const n = (counts.get(brand) ?? 0) + 1
    counts.set(brand, n)
    if (best === null || n > counts.get(best)!) best = brand
  }
  return best
}

/** «через 10 000 км · 273 дня после прошлой». */
function sinceText(r: Replacement): string | null {
  const parts = [
    r.sinceKm !== undefined ? formatKm(r.sinceKm) : null,
    r.sinceDays !== undefined ? daysText(r.sinceDays) : null,
  ].filter(Boolean)
  return parts.length > 0 ? `через ${parts.join(' · ')} после прошлой` : null
}

function metaText(r: Replacement, lookup: Lookup | undefined): string {
  const parts = [formatDate(r.date)]
  if (r.odometer !== undefined) parts.push(formatKm(r.odometer))
  if (r.placeId && lookup) parts.push(lookup.places.get(r.placeId)?.name ?? MISSING_PLACE)
  return parts.join(' · ')
}

function HistoryContent({ vehicle, itemId }: { vehicle: Vehicle; itemId: ID }) {
  const navigate = useNavigate()
  const entries = useItemHistory(vehicle.id, itemId)
  const rules = useReminderRules(vehicle.id)
  const lookup = useLookup()
  if (!entries || !rules) return null

  const rule = rules.find((r) => r.itemId === itemId)
  const reps = toReplacements(entries)
  const average = averageText(reps)
  const brand = topBrand(entries)

  const reminder = rule ? (
    <ListGroup>
      <ListItem
        title="Напоминание"
        subtitle={ruleSummary(rule) || undefined}
        leading={<Icon icon={IconHistory} tone="accent" circle />}
        chevron
        onClick={() => void navigate(`/reminders/${rule.id}`)}
      />
    </ListGroup>
  ) : (
    <ListGroup>
      <ListItem
        title="Напоминать о замене"
        leading={<Icon icon={IconBellPlus} tone="accent" circle />}
        chevron
        onClick={() => void navigate(`/reminders/new?item=${encodeURIComponent(itemId)}`)}
      />
    </ListGroup>
  )

  if (reps.length === 0) {
    return (
      <>
        <EmptyState
          icon={<IconHistory />}
          title="Замен пока не было"
          text="Замена появится здесь, когда в записи ТО будет запчасть или работа с этим узлом."
        />
        {reminder}
      </>
    )
  }

  return (
    <>
      <Card padded className={styles.summary}>
        <p className={styles.count}>Замен: {reps.length}</p>
        {average && <p className={styles.fact}>{average}</p>}
        {brand && <p className={styles.fact}>Чаще всего: {brand}</p>}
      </Card>
      {reminder}
      <ListGroup title="Замены">
        {reps.map((r) => {
          const since = sinceText(r)
          return (
            <button
              key={r.recordId}
              type="button"
              className={styles.row}
              onClick={() => void navigate(`/record/${r.recordId}`)}
            >
              <span className={styles.head}>
                <span className={styles.title}>{r.title}</span>
                {r.price !== undefined && <span className={styles.price}>{formatMoney(r.price)}</span>}
              </span>
              <span className={styles.meta}>{metaText(r, lookup)}</span>
              {since && <span className={styles.meta}>{since}</span>}
            </button>
          )
        })}
      </ListGroup>
    </>
  )
}

/** История узла по активной машине: `/items/:itemId`. */
export default function ItemHistoryPage() {
  const { itemId = '' } = useParams()
  const lookup = useLookup()
  const title = lookup?.catalog.get(itemId)?.name ?? 'История узла'
  return (
    <Page title={title} back>
      <VehicleGate>{(vehicle) => <HistoryContent vehicle={vehicle} itemId={itemId} />}</VehicleGate>
    </Page>
  )
}
