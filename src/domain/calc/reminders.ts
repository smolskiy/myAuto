import { addDays, addMonths, diffDays } from '../dates'
import { DOCUMENT_KIND_LABELS, EXPENSE_CATEGORY_LABELS } from '../labels'
import type {
  CarRecord,
  CatalogItem,
  DocumentKind,
  ExpenseCategory,
  ExpenseRecord,
  ID,
  ISODate,
  ReminderRule,
  ServiceRecord,
  VehicleDocument,
} from '../types'

export type ReminderState = 'ok' | 'soon' | 'overdue' | 'unknown'

export interface ReminderStatus {
  ruleId: ID
  vehicleId: ID
  title: string
  itemId?: ID
  state: ReminderState
  last?: { date: ISODate; odometer?: number; recordId?: ID; source: 'record' | 'baseline' }
  dueKm?: number
  dueDate?: ISODate
  remainingKm?: number
  remainingDays?: number
  predictedDate?: ISODate
  /** Доля пройденного интервала по км, 0…1+ (для полосок). */
  progressKm?: number
  /** Доля прошедшего интервала по времени, 0…1+. */
  progressTime?: number
  /** Состояние только по км и только по времени: итог `state` — худшее из них. */
  stateKm?: ReminderState
  stateTime?: ReminderState
}

export interface ReminderContext {
  records: CarRecord[]
  catalog: CatalogItem[]
  today: ISODate
  currentOdometer: number | null
  avgDailyKm: number | null
}

/** Подписи видов документов (источник — `domain/labels.ts`). */
export const DOCUMENT_TITLES: Record<DocumentKind, string> = DOCUMENT_KIND_LABELS

/** Подписи категорий расходов (источник — `domain/labels.ts`). */
export const EXPENSE_TITLES: Record<ExpenseCategory, string> = EXPENSE_CATEGORY_LABELS

const STATE_RANK: Record<ReminderState, number> = { overdue: 0, soon: 1, ok: 2, unknown: 3 }
const worst = (a: ReminderState, b: ReminderState): ReminderState => (STATE_RANK[a] <= STATE_RANK[b] ? a : b)

const isLater = (r: ServiceRecord, than: ServiceRecord | null) =>
  !than || r.date > than.date || (r.date === than.date && (r.odometer ?? -1) > (than.odometer ?? -1))

/**
 * Последнее выполнение: самая поздняя по (дата, пробег) живая запись ТО с работой или запчастью этого узла,
 * и самая поздняя из них с пробегом — от неё считается срок по км, если у последней записи пробега нет.
 */
function lastService(
  records: CarRecord[],
  vehicleId: ID,
  itemId: ID,
): { latest: ServiceRecord | null; withOdometer: ServiceRecord | null } {
  let latest: ServiceRecord | null = null
  let withOdometer: ServiceRecord | null = null
  for (const r of records) {
    if (r.kind !== 'service' || r.deleted || r.vehicleId !== vehicleId) continue
    if (!r.works.some((w) => w.itemId === itemId) && !r.parts.some((p) => p.itemId === itemId)) continue
    if (isLater(r, latest)) latest = r
    if (r.odometer !== undefined && isLater(r, withOdometer)) withOdometer = r
  }
  return { latest, withOdometer }
}

/**
 * Статус напоминания (спецификация, раздел 5): последнее выполнение → срок по км и по времени → остатки →
 * «скоро», если остаток ≤ max(1000 км, 10 % интервала) или ≤ max(30 дней, 10 % интервала); «просрочено» при остатке ≤ 0;
 * итог — худший. Разовое напоминание к дате без выполнения — «скоро» за 30 дней.
 */
export function evaluateReminder(rule: ReminderRule, ctx: ReminderContext): ReminderStatus {
  const item = rule.itemId ? ctx.catalog.find((i) => i.id === rule.itemId && !i.deleted) : undefined
  const status: ReminderStatus = {
    ruleId: rule.id,
    vehicleId: rule.vehicleId,
    title: rule.title?.trim() || item?.name || 'Напоминание',
    state: 'unknown',
  }
  if (rule.itemId) status.itemId = rule.itemId

  let lastDate: ISODate | undefined
  let lastOdo: number | undefined
  const found = rule.itemId ? lastService(ctx.records, rule.vehicleId, rule.itemId) : null
  const record = found?.latest
  if (record) {
    lastDate = record.date
    lastOdo = found.withOdometer?.odometer
    status.last = { date: record.date, recordId: record.id, source: 'record' }
    if (record.odometer !== undefined) status.last.odometer = record.odometer
  } else if (rule.baseline && (rule.baseline.date || rule.baseline.odometer !== undefined)) {
    lastDate = rule.baseline.date
    lastOdo = rule.baseline.odometer
    // ReminderStatus.last требует дату: точка отсчёта только с пробегом считает срок по км, но в last не попадает.
    if (lastDate) {
      status.last = { date: lastDate, source: 'baseline' }
      if (lastOdo !== undefined) status.last.odometer = lastOdo
    }
  } else if (!rule.dueDate) {
    return status
  }

  if (lastOdo !== undefined && rule.intervalKm) {
    status.dueKm = lastOdo + rule.intervalKm
    if (ctx.currentOdometer !== null) {
      status.remainingKm = status.dueKm - ctx.currentOdometer
      status.progressKm = (ctx.currentOdometer - lastOdo) / rule.intervalKm
    }
  }

  const dueDate = lastDate && rule.intervalMonths ? addMonths(lastDate, rule.intervalMonths) : rule.dueDate
  if (dueDate) {
    status.dueDate = dueDate
    status.remainingDays = diffDays(ctx.today, dueDate)
    if (lastDate) {
      const span = diffDays(lastDate, dueDate)
      if (span > 0) status.progressTime = diffDays(lastDate, ctx.today) / span
    }
  }

  let state: ReminderState | null = null
  if (status.remainingKm !== undefined) {
    const soonKm = Math.max(1000, 0.1 * (rule.intervalKm ?? 0))
    state = status.remainingKm <= 0 ? 'overdue' : status.remainingKm <= soonKm ? 'soon' : 'ok'
    status.stateKm = state
  }
  if (status.remainingDays !== undefined) {
    const span = lastDate && dueDate ? diffDays(lastDate, dueDate) : 0
    const soonDays = Math.max(30, 0.1 * span)
    const byTime: ReminderState =
      status.remainingDays <= 0 ? 'overdue' : status.remainingDays <= soonDays ? 'soon' : 'ok'
    status.stateTime = byTime
    state = state ? worst(state, byTime) : byTime
  }
  if (state) status.state = state

  const byKm =
    status.remainingKm !== undefined && ctx.avgDailyKm !== null && ctx.avgDailyKm > 0
      ? addDays(ctx.today, Math.ceil(status.remainingKm / ctx.avgDailyKm))
      : undefined
  const predicted = [byKm, dueDate].filter((d): d is ISODate => d !== undefined).sort()[0]
  if (predicted) status.predictedDate = predicted

  return status
}

/** Статусы включённых и неудалённых правил. */
export function evaluateReminders(rules: ReminderRule[], ctx: ReminderContext): ReminderStatus[] {
  return rules.filter((r) => r.enabled && !r.deleted).map((r) => evaluateReminder(r, ctx))
}

export interface DeadlineStatus {
  key: string
  vehicleId: ID
  kind: DocumentKind | ExpenseCategory
  title: string
  validUntil: ISODate
  remainingDays: number
  state: Exclude<ReminderState, 'unknown'>
  source: { type: 'document' | 'expense'; id: ID }
}

const EXPENSE_TO_DOCUMENT: Partial<Record<ExpenseCategory, DocumentKind>> = {
  osago: 'osago',
  kasko: 'kasko',
  inspection: 'diagCard',
}

/**
 * Сроки документов и полисов: по каждому виду (на машину) — самая поздняя дата действия.
 * ОСАГО/КАСКО/диагностическая карта из расходов и из документов — один вид. «Скоро» — за 30 дней,
 * «просрочено» — после последнего дня действия. Прочие документы (`other`) не объединяются между собой.
 */
export function documentDeadlines(
  docs: VehicleDocument[],
  records: CarRecord[],
  today: ISODate,
): DeadlineStatus[] {
  const groups = new Map<string, Omit<DeadlineStatus, 'remainingDays' | 'state'>>()
  const offer = (
    vehicleId: ID,
    kind: DocumentKind,
    validUntil: ISODate,
    title: string,
    source: DeadlineStatus['source'],
  ) => {
    const key =
      kind === 'other' ? `deadline:other:${vehicleId}:${source.id}` : `deadline:${kind}:${vehicleId}`
    const current = groups.get(key)
    if (!current || validUntil > current.validUntil)
      groups.set(key, { key, vehicleId, kind, title, validUntil, source })
  }

  for (const d of docs) {
    if (d.deleted || !d.validUntil) continue
    const title = d.kind === 'other' ? d.title?.trim() || DOCUMENT_TITLES.other : DOCUMENT_TITLES[d.kind]
    offer(d.vehicleId, d.kind, d.validUntil, title, { type: 'document', id: d.id })
  }
  for (const r of records) {
    if (r.kind !== 'expense' || r.deleted) continue
    const e: ExpenseRecord = r
    const kind = EXPENSE_TO_DOCUMENT[e.category]
    if (!kind || !e.validUntil) continue
    offer(e.vehicleId, kind, e.validUntil, DOCUMENT_TITLES[kind], { type: 'expense', id: e.id })
  }

  return [...groups.values()]
    .map((g): DeadlineStatus => {
      const remainingDays = diffDays(today, g.validUntil)
      const state = remainingDays < 0 ? 'overdue' : remainingDays <= 30 ? 'soon' : 'ok'
      return { ...g, remainingDays, state }
    })
    .sort((a, b) => a.validUntil.localeCompare(b.validUntil) || a.key.localeCompare(b.key))
}

export interface UpcomingItem {
  key: string
  type: 'reminder' | 'deadline'
  title: string
  state: ReminderState
  remainingKm?: number
  remainingDays?: number
  predictedDate?: ISODate
  reminder?: ReminderStatus
  deadline?: DeadlineStatus
}

/** Общий список «Скоро»: просроченные → скоро → в порядке → без данных; внутри — по ближайшей дате. */
export function upcoming(
  reminders: ReminderStatus[],
  deadlines: DeadlineStatus[],
  limit?: number,
): UpcomingItem[] {
  const items: { item: UpcomingItem; date?: ISODate }[] = []
  for (const r of reminders) {
    const item: UpcomingItem = {
      key: `reminder:${r.ruleId}`,
      type: 'reminder',
      title: r.title,
      state: r.state,
      reminder: r,
    }
    if (r.remainingKm !== undefined) item.remainingKm = r.remainingKm
    if (r.remainingDays !== undefined) item.remainingDays = r.remainingDays
    if (r.predictedDate) item.predictedDate = r.predictedDate
    items.push({ item, date: r.predictedDate ?? r.dueDate })
  }
  for (const d of deadlines) {
    items.push({
      item: {
        key: d.key,
        type: 'deadline',
        title: d.title,
        state: d.state,
        remainingDays: d.remainingDays,
        deadline: d,
      },
      date: d.validUntil,
    })
  }
  items.sort((a, b) => {
    const byState = STATE_RANK[a.item.state] - STATE_RANK[b.item.state]
    if (byState !== 0) return byState
    if (a.date !== b.date) {
      if (a.date === undefined) return 1
      if (b.date === undefined) return -1
      return a.date.localeCompare(b.date)
    }
    return a.item.key.localeCompare(b.item.key)
  })
  const sorted = items.map((i) => i.item)
  return limit === undefined ? sorted : sorted.slice(0, limit)
}
