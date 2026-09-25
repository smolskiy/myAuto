import type { Draft } from '../../../db/repo'
import { isISODate } from '../../../domain/dates'
import { applyVinToVehicle, type VinApplyInfo } from '../../../domain/vin/decode'
import type { Drive, Fluid, FuelType, ISODate, Kopecks, Transmission, Vehicle } from '../../../domain/types'

/** Значения формы машины: тексты — строки (как их держат поля), пустое — ''. */
export interface VehicleValues {
  name: string
  make: string
  model: string
  generation: string
  /** Год — текстом: у NumberField разряды («2 019»), году они не нужны. */
  year: string
  vin: string
  plate: string
  color: string
  bodyType: string
  fuel?: FuelType
  displacementCc?: number
  powerHp?: number
  engineCode: string
  transmission?: Transmission
  drive?: Drive
  tankLiters?: number
  defaultFuelGrade: string
  purchaseDate: ISODate | ''
  purchaseOdometer?: number
  purchasePrice?: Kopecks
  saleDate: ISODate | ''
  saleOdometer?: number
  salePrice?: Kopecks
  fluids: Fluid[]
  tireSizeFront: string
  tireSizeRear: string
  /** Картинка на главной: '' — подобрать по модели, 'none' — без картинки, иначе id картинки. */
  schematic: string
  note: string
}

export type VehicleErrors = Partial<Record<keyof VehicleValues, string>>

export function vehicleToValues(v?: Vehicle): VehicleValues {
  return {
    name: v?.name ?? '',
    make: v?.make ?? '',
    model: v?.model ?? '',
    generation: v?.generation ?? '',
    year: v?.year !== undefined ? String(v.year) : '',
    vin: v?.vin ?? '',
    plate: v?.plate ?? '',
    color: v?.color ?? '',
    bodyType: v?.bodyType ?? '',
    fuel: v?.engine?.fuel,
    displacementCc: v?.engine?.displacementCc,
    powerHp: v?.engine?.powerHp,
    engineCode: v?.engine?.code ?? '',
    transmission: v?.transmission,
    drive: v?.drive,
    tankLiters: v?.tankLiters,
    defaultFuelGrade: v?.defaultFuelGrade ?? '',
    purchaseDate: v?.purchase?.date ?? '',
    purchaseOdometer: v?.purchase?.odometer,
    purchasePrice: v?.purchase?.price,
    saleDate: v?.sale?.date ?? '',
    saleOdometer: v?.sale?.odometer,
    salePrice: v?.sale?.price,
    fluids: v?.fluids ?? [],
    tireSizeFront: v?.tireSizeFront ?? '',
    tireSizeRear: v?.tireSizeRear ?? '',
    schematic: v?.schematic ?? '',
    note: v?.note ?? '',
  }
}

/** «Марка Модель» — название по умолчанию. */
export const defaultName = (v: Pick<VehicleValues, 'make' | 'model'>) =>
  `${v.make.trim()} ${v.model.trim()}`.trim()

/**
 * Данные VIN (офлайн или онлайн) — только в пустые поля: введённое владельцем не перетирается
 * (правило `applyVinToVehicle` из domain/vin).
 */
export function applyVin(values: VehicleValues, info: VinApplyInfo): Partial<VehicleValues> {
  const draft: Partial<Vehicle> = {
    make: values.make.trim(),
    model: values.model.trim(),
    year: values.year ? Number(values.year) : undefined,
    transmission: values.transmission,
    drive: values.drive,
    bodyType: values.bodyType.trim(),
    engine: { fuel: values.fuel, displacementCc: values.displacementCc, powerHp: values.powerHp },
  }
  const out = applyVinToVehicle(draft, info)
  return {
    make: out.make ?? '',
    model: out.model ?? '',
    year: out.year !== undefined ? String(out.year) : '',
    transmission: out.transmission,
    drive: out.drive,
    bodyType: out.bodyType ?? '',
    fuel: out.engine?.fuel,
    displacementCc: out.engine?.displacementCc,
    powerHp: out.engine?.powerHp,
  }
}

const MIN_YEAR = 1900

export function validateVehicle(v: VehicleValues, today: ISODate): VehicleErrors {
  const e: VehicleErrors = {}
  if (!v.make.trim()) e.make = 'Укажите марку'
  if (!v.model.trim()) e.model = 'Укажите модель'
  if (v.year) {
    const y = Number(v.year)
    if (!Number.isInteger(y) || y < MIN_YEAR || y > Number(today.slice(0, 4)) + 1) e.year = 'Проверьте год'
  }
  if (v.purchaseDate && !isISODate(v.purchaseDate)) e.purchaseDate = 'Проверьте дату'
  if (v.saleDate && !isISODate(v.saleDate)) e.saleDate = 'Проверьте дату'
  return e
}

const text = (s: string) => s.trim() || undefined

/** Объект без пустых полей или undefined, если пусто всё. */
function compact<T extends object>(o: T): T | undefined {
  const entries = Object.entries(o).filter(([, value]) => value !== undefined)
  return entries.length > 0 ? (Object.fromEntries(entries) as T) : undefined
}

/**
 * Черновик машины. Поля, которых в форме нет (порядок, заметки покупки и продажи, фото), берутся из `initial`.
 * Архив: дата продажи — в архив; дату продажи стёрли — из архива; иначе как было (архив из гаража).
 */
export function valuesToDraft(
  v: VehicleValues,
  initial: Vehicle | undefined,
  extra: { order: number; photoAttachmentId?: string },
): Draft<Vehicle> {
  const hadSale = !!initial?.sale?.date
  const archived = v.saleDate ? true : hadSale ? false : (initial?.archived ?? false)
  return {
    name: v.name.trim() || defaultName(v),
    make: v.make.trim(),
    model: v.model.trim(),
    generation: text(v.generation),
    year: v.year ? Number(v.year) : undefined,
    vin: text(v.vin),
    plate: text(v.plate.toUpperCase()),
    color: text(v.color),
    bodyType: text(v.bodyType),
    engine: compact({
      code: text(v.engineCode),
      displacementCc: v.displacementCc,
      powerHp: v.powerHp,
      fuel: v.fuel,
    }),
    transmission: v.transmission,
    drive: v.drive,
    tankLiters: v.tankLiters,
    defaultFuelGrade: text(v.defaultFuelGrade),
    purchase: compact({
      ...initial?.purchase,
      date: v.purchaseDate || undefined,
      odometer: v.purchaseOdometer,
      price: v.purchasePrice,
    }),
    sale: compact({
      ...initial?.sale,
      date: v.saleDate || undefined,
      odometer: v.saleOdometer,
      price: v.salePrice,
    }),
    archived,
    fluids: v.fluids,
    tireSizeFront: text(v.tireSizeFront),
    tireSizeRear: text(v.tireSizeRear),
    photoAttachmentId: extra.photoAttachmentId,
    schematic: v.schematic || undefined,
    note: text(v.note),
    order: extra.order,
  }
}
