import { useCallback, useReducer } from 'react'
import type { Draft } from '../../../db/repo'
import { isISODate } from '../../../domain/dates'
import type {
  CarRecord,
  ExpenseCategory,
  ID,
  ISODate,
  Kopecks,
  PartLine,
  RecordKind,
  ServiceType,
  Vehicle,
  WorkLine,
} from '../../../domain/types'
import { linesTotal } from './serviceTotals'

/** Расходы со сроком действия: полисы и диагностическая карта. */
export const VALIDITY_CATEGORIES: ReadonlySet<ExpenseCategory> = new Set(['osago', 'kasko', 'inspection'])

/**
 * Значения формы записи любого вида — плоско, чтобы общие поля (дата, пробег, место, заметка) жили в одном
 * месте. Пустые даты и тексты — '' (так их держат поля ввода); в запись они уходят как undefined.
 */
export interface RecordFormValues {
  kind: RecordKind
  vehicleId: ID
  date: ISODate
  odometer?: number
  total?: Kopecks
  placeId?: ID
  note: string
  /** Название ТО, заметки или расхода. */
  title: string
  // Расход
  category: ExpenseCategory
  validFrom: ISODate | ''
  validUntil: ISODate | ''
  docNumber: string
  // ТО и ремонт
  serviceType: ServiceType
  masterId?: ID
  diy: boolean
  works: WorkLine[]
  parts: PartLine[]
  /** Итог введён руками — больше не пересчитывается от строк, пока не нажмут «Считать по строкам». */
  totalManual: boolean
  warrantyUntilDate: ISODate | ''
  warrantyUntilKm?: number
  mountedSetId?: ID
  removedSetId?: ID
}

export type FieldKey = keyof RecordFormValues
export type FormErrors = Partial<Record<FieldKey, string>>

interface State {
  values: RecordFormValues
  errors: FormErrors
}

type Action =
  | { type: 'set'; patch: Partial<RecordFormValues> }
  | { type: 'update'; fn: (v: RecordFormValues) => Partial<RecordFormValues> }
  | { type: 'errors'; errors: FormErrors }

function apply(state: State, patch: Partial<RecordFormValues>): State {
  // Правка поля убирает его ошибку — сообщение не висит над уже исправленным значением.
  const errors = { ...state.errors }
  for (const key of Object.keys(patch) as FieldKey[]) delete errors[key]
  return { values: { ...state.values, ...patch }, errors }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'set':
      return apply(state, action.patch)
    case 'update':
      return apply(state, action.fn(state.values))
    case 'errors':
      return { ...state, errors: action.errors }
  }
}

export interface RecordForm {
  values: RecordFormValues
  errors: FormErrors
  set(patch: Partial<RecordFormValues>): void
  /** Правка от текущих значений (строки ТО, два из трёх у заправки). */
  update(fn: (v: RecordFormValues) => Partial<RecordFormValues>): void
  setErrors(errors: FormErrors): void
}

/** Состояние формы записи: локальный редьюсер, в базу — только по «Сохранить». */
export function useRecordForm(initial: RecordFormValues): RecordForm {
  const [state, dispatch] = useReducer(reducer, initial, (values): State => ({ values, errors: {} }))
  const set = useCallback((patch: Partial<RecordFormValues>) => dispatch({ type: 'set', patch }), [])
  const update = useCallback(
    (fn: (v: RecordFormValues) => Partial<RecordFormValues>) => dispatch({ type: 'update', fn }),
    [],
  )
  const setErrors = useCallback((errors: FormErrors) => dispatch({ type: 'errors', errors }), [])
  return { values: state.values, errors: state.errors, set, update, setErrors }
}

const BLANK: Omit<RecordFormValues, 'kind' | 'vehicleId' | 'date'> = {
  note: '',
  title: '',
  category: 'other',
  validFrom: '',
  validUntil: '',
  docNumber: '',
  serviceType: 'maintenance',
  diy: false,
  works: [],
  parts: [],
  totalManual: false,
  warrantyUntilDate: '',
}

/** Новая запись: дата — сегодня, пробег — текущий (кроме заметки, у неё пробег необязателен). */
export function newRecordValues(
  kind: RecordKind,
  vehicle: Pick<Vehicle, 'id'>,
  ctx: { today: ISODate; currentOdometer: number | null },
): RecordFormValues {
  return {
    ...BLANK,
    kind,
    vehicleId: vehicle.id,
    date: ctx.today,
    odometer: kind === 'note' ? undefined : (ctx.currentOdometer ?? undefined),
  }
}

/** Значения формы из сохранённой записи (правка). */
export function recordToValues(r: CarRecord): RecordFormValues {
  const v: RecordFormValues = {
    ...BLANK,
    kind: r.kind,
    vehicleId: r.vehicleId,
    date: r.date,
    odometer: r.odometer,
    total: r.total,
    placeId: r.placeId,
    note: r.note ?? '',
  }
  switch (r.kind) {
    case 'expense':
      return {
        ...v,
        category: r.category,
        title: r.title ?? '',
        validFrom: r.validFrom ?? '',
        validUntil: r.validUntil ?? '',
        docNumber: r.docNumber ?? '',
      }
    case 'note':
      return { ...v, title: r.title }
    case 'service':
      return {
        ...v,
        title: r.title,
        serviceType: r.serviceType,
        masterId: r.masterId,
        diy: r.diy,
        works: r.works,
        parts: r.parts,
        // Итог не сходится со строками — его вводили руками; так и оставляем.
        totalManual: r.total !== linesTotal(r.works, r.parts),
        warrantyUntilDate: r.warrantyUntilDate ?? '',
        warrantyUntilKm: r.warrantyUntilKm,
        mountedSetId: r.tireSwap?.mountedSetId,
        removedSetId: r.tireSwap?.removedSetId,
      }
    default:
      return v
  }
}

/** Смена шин с выбранным комплектом: без пробега не посчитать пробег комплекта. */
export function hasTireSwap(v: RecordFormValues): boolean {
  return v.serviceType === 'tires' && !!(v.mountedSetId || v.removedSetId)
}

/** Итог ТО на экране и в записи: ручной — как введён, иначе сумма строк. */
export function serviceTotal(v: RecordFormValues): Kopecks {
  return v.totalManual ? (v.total ?? 0) : linesTotal(v.works, v.parts)
}

/** Ошибки у полей; пустой объект — можно сохранять. */
export function validate(v: RecordFormValues): FormErrors {
  const e: FormErrors = {}
  if (!isISODate(v.date)) e.date = 'Укажите дату'
  switch (v.kind) {
    case 'odometer':
      if (v.odometer === undefined) e.odometer = 'Укажите пробег'
      break
    case 'note':
      if (!v.title.trim()) e.title = 'Добавьте название'
      break
    case 'expense':
      if (!v.total) e.total = 'Укажите сумму'
      if (VALIDITY_CATEGORIES.has(v.category) && v.validFrom && v.validUntil && v.validUntil < v.validFrom)
        e.validUntil = 'Раньше даты начала'
      break
    case 'service':
      if (!v.title.trim()) e.title = 'Добавьте название'
      if (hasTireSwap(v) && v.odometer === undefined)
        e.odometer = 'Укажите пробег — без него не посчитать пробег шин'
      break
  }
  return e
}

const text = (s: string) => s.trim() || undefined
const date = (s: ISODate | '') => s || undefined

/**
 * Черновик записи. Необязательные поля присутствуют и тогда, когда пусты (undefined): правка
 * перезаписывает ими старые значения — очищенное поле очищается и в базе.
 */
export function toDraft(v: RecordFormValues): Draft<CarRecord> {
  const base = { vehicleId: v.vehicleId, date: v.date, odometer: v.odometer, note: text(v.note) }
  switch (v.kind) {
    case 'odometer':
      return { ...base, kind: 'odometer', total: 0, placeId: undefined }
    case 'note':
      return { ...base, kind: 'note', total: 0, placeId: undefined, title: v.title.trim() }
    case 'expense': {
      const validity = VALIDITY_CATEGORIES.has(v.category)
      return {
        ...base,
        kind: 'expense',
        total: v.total ?? 0,
        placeId: v.placeId,
        category: v.category,
        title: text(v.title),
        validFrom: validity ? date(v.validFrom) : undefined,
        validUntil: validity ? date(v.validUntil) : undefined,
        docNumber: validity ? text(v.docNumber) : undefined,
      }
    }
    case 'service': {
      const swap = hasTireSwap(v)
      return {
        ...base,
        kind: 'service',
        total: serviceTotal(v),
        placeId: v.placeId,
        title: v.title.trim(),
        serviceType: v.serviceType,
        masterId: v.diy ? undefined : v.masterId,
        diy: v.diy,
        works: v.works,
        parts: v.parts,
        warrantyUntilDate: date(v.warrantyUntilDate),
        warrantyUntilKm: v.warrantyUntilKm,
        tireSwap: swap ? { mountedSetId: v.mountedSetId, removedSetId: v.removedSetId } : undefined,
      }
    }
    default:
      throw new Error('Этот вид записи пока не поддерживается')
  }
}
