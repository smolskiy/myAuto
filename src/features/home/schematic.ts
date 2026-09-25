import { type ReminderStatus, upcoming } from '../../domain/calc/reminders'
import { CATALOG_ID as C } from '../../domain/catalog'
import type { CatalogItem, ID, ItemGroup, Vehicle } from '../../domain/types'
import type { SchematicMark, SchematicModel, SchematicZone, VehicleSchematicProps } from '../../ui'
import { kmText, timeText } from './reminderText'

/** Нижний регистр без диакритики, пробелов, апострофов и дефисов: «cee’d SW» → «ceedsw», «ŠKODA» → «skoda». */
const squash = (s = '') =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s'’`´_.-]/g, '')

const inYears = (year: number | undefined, from: number, to: number) =>
  year === undefined || (year >= from && year <= to)

/** Универсал, Scout, Tour и другие поколения (A4, A6–A8; «А» — латиницей или кириллицей). */
const OCTAVIA_OTHER_BODY =
  /combi|комби|kombi|универсал|wagon|estate|scout|скаут|tour|(^|\s)тур(\s|$)|(^|[^a-zа-я0-9])[aа][4678]([^0-9]|$)/

/** Хэтчбек, купе, седан — у cee’d первого поколения чертёж только универсала. */
const CEED_OTHER_BODY = /х[эе]тчб[эе]к|hatch|купе|coupe|седан|sedan|лифтб[эе]к|liftback/

/** pro_cee’d / «Про Сид» и XCeed / «ИксСид» — другие машины. */
const CEED_OTHER_MODEL = /pro|про|xceed|икс/

/**
 * Для какой машины есть чертёж. Год и кузов проверяются, только если указаны: владелец мог их не заполнить,
 * а похожий чертёж лучше, чем никакого. Octavia A5 — 2004–2013 (лифтбек), cee’d первого поколения — 2006–2012.
 */
export function schematicModelFor(v: Vehicle): SchematicModel | null {
  const make = squash(v.make)
  const model = squash(v.model)
  const details = [v.model, v.generation, v.bodyType].filter(Boolean).join(' ').toLowerCase()

  if ((make === 'skoda' || make === 'шкода') && /octavia|октавия/.test(model)) {
    return inYears(v.year, 2004, 2013) && !OCTAVIA_OTHER_BODY.test(details) ? 'octavia-a5' : null
  }
  if ((make === 'kia' || make === 'киа') && /ceed|сид/.test(model) && !CEED_OTHER_MODEL.test(model)) {
    return inYears(v.year, 2006, 2012) && !CEED_OTHER_BODY.test(details) ? 'ceed-sw-1' : null
  }
  return null
}

/** Узлы, чья зона не следует из группы каталога. */
const ITEM_ZONE: Partial<Record<ID, SchematicZone>> = {
  [C.waterPump]: 'timing',
  [C.brakeFluid]: 'brakes',
  [C.coolant]: 'cooling',
  [C.powerSteeringFluid]: 'engine',
  [C.brakePadsRear]: 'wheelRear',
  [C.brakeDiscsRear]: 'wheelRear',
  [C.bulbs]: 'lights',
  [C.cabinFilter]: 'cabin',
  [C.wiperBlades]: 'cabin',
  [C.washerFluid]: 'cabin',
}

/** Зона по группе — для остальных встроенных и своих узлов. Кузов и «Прочее» на чертеже не отмечаются. */
const GROUP_ZONE: Record<ItemGroup, SchematicZone | null> = {
  engine: 'engine',
  fluids: 'engine',
  filters: 'engine',
  ignition: 'engine',
  timing: 'timing',
  transmission: 'transmission',
  brakes: 'wheelFront',
  suspension: 'wheelFront',
  steering: 'wheelFront',
  electrical: 'battery',
  climate: 'cabin',
  tires: 'wheelFront',
  body: null,
  other: null,
}

export function zoneOfItem(itemId: ID, catalog: CatalogItem[]): SchematicZone | null {
  const fixed = ITEM_ZONE[itemId]
  if (fixed) return fixed
  const item = catalog.find((i) => i.id === itemId)
  return item ? GROUP_ZONE[item.group] : null
}

/** Короткие названия для выноски: плашка на чертеже узкая. */
const SHORT_TITLE: Partial<Record<ID, string>> = {
  [C.engineOil]: 'Масло',
  [C.timingBelt]: 'Ремень ГРМ',
  [C.coolant]: 'Антифриз',
  [C.atf]: 'Масло АКПП',
  [C.transferCaseOil]: 'Масло раздатки',
  [C.brakePadsFront]: 'Передние колодки',
  [C.brakePadsRear]: 'Задние колодки',
  [C.brakeDiscsFront]: 'Передние диски',
  [C.brakeDiscsRear]: 'Задние диски',
  [C.suspensionCheck]: 'Подвеска',
  [C.acService]: 'Кондиционер',
  [C.wiperBlades]: 'Щётки',
}

/** Своё название напоминания владелец выбрал сам — его не сокращаем. */
function shortTitle(s: ReminderStatus, catalog: CatalogItem[]): string {
  const short = s.itemId ? SHORT_TITLE[s.itemId] : undefined
  const item = s.itemId ? catalog.find((i) => i.id === s.itemId) : undefined
  return short && item && s.title === item.name ? short : s.title
}

/** Срок, который дал состояние: по пробегу или по времени; дали оба — тот, что пройден больше. */
function dueText(s: ReminderStatus): string | undefined {
  const km = s.remainingKm !== undefined ? kmText(s.remainingKm) : undefined
  const time = s.remainingDays !== undefined ? timeText(s.remainingDays) : undefined
  if (!km || !time) return km ?? time
  const kmDecides = s.stateKm === s.state
  const timeDecides = s.stateTime === s.state
  if (kmDecides !== timeDecides) return kmDecides ? km : time
  return (s.progressKm ?? 0) >= (s.progressTime ?? 0) ? km : time
}

const MAX_CALLOUTS = 2

type SchematicData = Pick<VehicleSchematicProps, 'marks' | 'label'> & {
  counts: NonNullable<VehicleSchematicProps['counts']>
}

/**
 * Точки на чертеже по статусам напоминаний: в зоне — самое срочное (порядок как в «Скоро»), остальные в той же
 * зоне — «ещё N». Выноски — у первых двух зон. Счётчики легенды — по всем напоминаниям машины.
 */
export function schematicData(statuses: ReminderStatus[], catalog: CatalogItem[]): SchematicData {
  const ordered = upcoming(statuses, []).flatMap((u) => (u.reminder ? [u.reminder] : []))
  const problems = ordered.filter((s) => s.state === 'overdue' || s.state === 'soon')

  const byZone = new Map<SchematicZone, ReminderStatus[]>()
  for (const s of problems) {
    const zone = s.itemId ? zoneOfItem(s.itemId, catalog) : null
    if (zone) byZone.set(zone, [...(byZone.get(zone) ?? []), s])
  }

  const marks = [...byZone].map(([zone, [first, ...rest]], i): SchematicMark => {
    const lead = first as ReminderStatus
    const mark: SchematicMark = { zone, state: lead.state as SchematicMark['state'] }
    if (i >= MAX_CALLOUTS) return mark
    const detail = [dueText(lead), rest.length > 0 ? `ещё ${rest.length}` : undefined]
      .filter(Boolean)
      .join(' · ')
    return { ...mark, title: shortTitle(lead, catalog), ...(detail && { detail }) }
  })

  const counts = { overdue: 0, soon: 0, ok: 0 }
  for (const s of statuses) if (s.state !== 'unknown') counts[s.state] += 1

  const list = (state: ReminderStatus['state'], word: string) => {
    const titles = problems.filter((s) => s.state === state).map((s) => s.title)
    return titles.length > 0 ? `${word} — ${titles.join(', ')}` : undefined
  }
  const parts = [list('overdue', 'просрочено'), list('soon', 'скоро')].filter(Boolean)
  const label =
    parts.length > 0
      ? `Схема машины: ${parts.join('; ')}`
      : counts.ok > 0
        ? 'Схема машины: узлы в порядке'
        : 'Схема машины'

  return { marks, counts, label }
}
