import { useState } from 'react'
import { addMonths } from '../../domain/dates'
import type { ID, ISODate, PlaceKind, RecordKind } from '../../domain/types'
import type { RecordFilter } from '../../db/hooks'
import { BottomSheet, Button, Chip, DateField } from '../../ui'
import { CatalogItemPicker, PLACE_KIND_LABELS, PlacePicker, RECORD_KIND_LABELS } from '../common'
import styles from './JournalPage.module.css'

export type Period = 'all' | 'month' | '3m' | 'year' | 'custom'

export const PERIOD_LABELS: Record<Period, string> = {
  month: 'Этот месяц',
  '3m': '3 месяца',
  year: '12 месяцев',
  all: 'Всё время',
  custom: 'Свой',
}

/** Фильтр журнала — живёт в адресе (`?kind=fuel&q=…`): «назад» из записи возвращает тот же вид. */
export interface JournalFilter {
  q: string
  kinds: RecordKind[]
  itemId?: ID
  placeId?: ID
  period: Period
  from?: ISODate
  to?: ISODate
}

const KINDS = Object.keys(RECORD_KIND_LABELS) as RecordKind[]
const PERIODS = Object.keys(PERIOD_LABELS) as Period[]
export const ALL_PLACE_KINDS = Object.keys(PLACE_KIND_LABELS) as PlaceKind[]

export function readFilter(p: URLSearchParams): JournalFilter {
  const period = p.get('period') as Period | null
  return {
    q: p.get('q') ?? '',
    kinds: p.getAll('kind').filter((k): k is RecordKind => KINDS.includes(k as RecordKind)),
    itemId: p.get('item') ?? undefined,
    placeId: p.get('place') ?? undefined,
    period: period && PERIODS.includes(period) ? period : 'all',
    from: p.get('from') ?? undefined,
    to: p.get('to') ?? undefined,
  }
}

export function writeFilter(f: JournalFilter): URLSearchParams {
  const p = new URLSearchParams()
  if (f.q.trim()) p.set('q', f.q)
  for (const k of f.kinds) p.append('kind', k)
  if (f.itemId) p.set('item', f.itemId)
  if (f.placeId) p.set('place', f.placeId)
  if (f.period !== 'all') p.set('period', f.period)
  if (f.period === 'custom') {
    if (f.from) p.set('from', f.from)
    if (f.to) p.set('to', f.to)
  }
  return p
}

export const EMPTY_FILTER: JournalFilter = { q: '', kinds: [], period: 'all' }

/** Сколько фильтров из шторки включено (узел, место, период) — число на кнопке «Фильтры». */
export const sheetFilterCount = (f: JournalFilter) =>
  (f.itemId ? 1 : 0) + (f.placeId ? 1 : 0) + (f.period !== 'all' ? 1 : 0)

export const isFiltered = (f: JournalFilter) => !!f.q.trim() || f.kinds.length > 0 || sheetFilterCount(f) > 0

/** Фильтр для `useRecords`: период превращается в даты от `today`. */
export function toRecordFilter(f: JournalFilter, today: ISODate): RecordFilter {
  const range: { from?: ISODate; to?: ISODate } =
    f.period === 'month'
      ? { from: `${today.slice(0, 7)}-01` }
      : f.period === '3m'
        ? { from: addMonths(today, -3) }
        : f.period === 'year'
          ? { from: addMonths(today, -12) }
          : f.period === 'custom'
            ? { from: f.from, to: f.to }
            : {}
  return {
    kinds: f.kinds.length > 0 ? f.kinds : undefined,
    itemId: f.itemId,
    placeId: f.placeId,
    query: f.q.trim() || undefined,
    ...range,
  }
}

export interface JournalFiltersProps {
  open: boolean
  filter: JournalFilter
  today: ISODate
  onApply(f: JournalFilter): void
  onClose(): void
}

/** Шторка «Фильтры»: узел, место, период. «Показать» применяет, закрытие — отменяет. */
export function JournalFilters({ open, filter, today, onApply, onClose }: JournalFiltersProps) {
  const [draft, setDraft] = useState(filter)
  const patch = (p: Partial<JournalFilter>) => setDraft((d) => ({ ...d, ...p }))
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Фильтры"
      footer={
        <div className={styles.sheetActions}>
          <Button
            variant="secondary"
            onClick={() => setDraft({ ...draft, itemId: undefined, placeId: undefined, period: 'all' })}
          >
            Сбросить
          </Button>
          <Button onClick={() => onApply(draft)}>Показать</Button>
        </div>
      }
    >
      <div className={styles.sheetBody}>
        <CatalogItemPicker value={draft.itemId} onChange={(itemId) => patch({ itemId })} />
        <PlacePicker
          label="Место"
          kinds={ALL_PLACE_KINDS}
          value={draft.placeId}
          onChange={(placeId) => patch({ placeId })}
        />
        <div className={styles.periodGroup} role="group" aria-label="Период">
          <span className={styles.groupLabel} aria-hidden="true">
            Период
          </span>
          <div className={styles.chipWrap}>
            {PERIODS.map((p) => (
              <Chip key={p} selected={draft.period === p} onClick={() => patch({ period: p })}>
                {PERIOD_LABELS[p]}
              </Chip>
            ))}
          </div>
        </div>
        {draft.period === 'custom' && (
          <div className={styles.pair}>
            <DateField
              label="С"
              value={draft.from ?? ''}
              onChange={(from) => patch({ from })}
              today={today}
            />
            <DateField label="По" value={draft.to ?? ''} onChange={(to) => patch({ to })} today={today} />
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
