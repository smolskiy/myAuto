/** Замороженные контракты. Меняет только лидер — см. CLAUDE.md. */
export type ID = string
/** Целые копейки. */
export type Kopecks = number
/** 'YYYY-MM-DD' без часового пояса. */
export type ISODate = string

export interface Row {
  id: ID
  createdAt: number
  updatedAt: number
  /** Мягкое удаление: строка остаётся, чтобы удаление дошло до других устройств. */
  deleted?: boolean
}

export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'lpg' | 'cng'
export type Transmission = 'mt' | 'at' | 'cvt' | 'amt' | 'dct'
export type Drive = 'fwd' | 'rwd' | 'awd'
export type FluidKind =
  | 'engineOil'
  | 'coolant'
  | 'atf'
  | 'mtf'
  | 'brake'
  | 'powerSteering'
  | 'diffFront'
  | 'diffRear'
  | 'transferCase'

export interface Fluid {
  kind: FluidKind
  spec?: string
  volumeL?: number
  note?: string
}

export interface Vehicle extends Row {
  name: string
  make: string
  model: string
  generation?: string
  year?: number
  vin?: string
  plate?: string
  color?: string
  bodyType?: string
  engine?: { code?: string; displacementCc?: number; powerHp?: number; fuel?: FuelType }
  transmission?: Transmission
  drive?: Drive
  tankLiters?: number
  defaultFuelGrade?: string
  purchase?: { date?: ISODate; odometer?: number; price?: Kopecks; note?: string }
  sale?: { date?: ISODate; odometer?: number; price?: Kopecks; note?: string }
  archived: boolean
  fluids: Fluid[]
  tireSizeFront?: string
  tireSizeRear?: string
  photoAttachmentId?: ID
  note?: string
  order: number
}

export type RecordKind = 'service' | 'fuel' | 'expense' | 'odometer' | 'note'

export interface RecordBase extends Row {
  vehicleId: ID
  kind: RecordKind
  date: ISODate
  /** Обязателен для fuel, желателен для service. */
  odometer?: number
  /** Для odometer/note = 0. */
  total: Kopecks
  placeId?: ID
  note?: string
}

export type ServiceType = 'maintenance' | 'repair' | 'diagnostics' | 'bodywork' | 'tires' | 'tuning' | 'other'
export type PartUnit = 'pcs' | 'l' | 'set' | 'm' | 'kg'

export interface WorkLine {
  id: ID
  itemId?: ID
  name: string
  price?: Kopecks
  masterId?: ID
  note?: string
}

export interface PartLine {
  id: ID
  itemId?: ID
  name: string
  brand?: string
  partNumber?: string
  qty: number
  unit: PartUnit
  unitPrice?: Kopecks
  supplierPlaceId?: ID
  supplierName?: string
  /** true — купил сам, false — запчасть сервиса. */
  ownPart: boolean
  note?: string
}

export interface ServiceRecord extends RecordBase {
  kind: 'service'
  title: string
  serviceType: ServiceType
  masterId?: ID
  diy: boolean
  works: WorkLine[]
  parts: PartLine[]
  warrantyUntilDate?: ISODate
  warrantyUntilKm?: number
  tireSwap?: { mountedSetId?: ID; removedSetId?: ID }
}

export interface FuelRecord extends RecordBase {
  kind: 'fuel'
  liters: number
  pricePerLiter: Kopecks
  fullTank: boolean
  missedBefore: boolean
  fuelGrade?: string
}

export type ExpenseCategory =
  | 'osago'
  | 'kasko'
  | 'tax'
  | 'fine'
  | 'wash'
  | 'parking'
  | 'toll'
  | 'tireService'
  | 'tireStorage'
  | 'inspection'
  | 'accessories'
  | 'registration'
  | 'other'

export interface ExpenseRecord extends RecordBase {
  kind: 'expense'
  category: ExpenseCategory
  title?: string
  validFrom?: ISODate
  validUntil?: ISODate
  docNumber?: string
}

export interface OdometerRecord extends RecordBase {
  kind: 'odometer'
}

export interface NoteRecord extends RecordBase {
  kind: 'note'
  title: string
}

export type CarRecord = ServiceRecord | FuelRecord | ExpenseRecord | OdometerRecord | NoteRecord

export type PlaceKind = 'service' | 'fuel' | 'parts' | 'wash' | 'tire' | 'insurance' | 'other'
export type Rating = 1 | 2 | 3 | 4 | 5

export interface Place extends Row {
  kind: PlaceKind
  name: string
  address?: string
  phone?: string
  url?: string
  rating?: Rating
  note?: string
}

export interface Master extends Row {
  name: string
  placeId?: ID
  phone?: string
  specialization?: string
  rating?: Rating
  note?: string
}

export type ItemGroup =
  | 'engine'
  | 'fluids'
  | 'filters'
  | 'ignition'
  | 'timing'
  | 'transmission'
  | 'brakes'
  | 'suspension'
  | 'steering'
  | 'electrical'
  | 'climate'
  | 'body'
  | 'tires'
  | 'other'

export interface CatalogItem extends Row {
  name: string
  group: ItemGroup
  defaultIntervalKm?: number
  defaultIntervalMonths?: number
  builtin: boolean
  hidden?: boolean
}

export interface ReminderRule extends Row {
  vehicleId: ID
  itemId?: ID
  title?: string
  intervalKm?: number
  intervalMonths?: number
  baseline?: { date?: ISODate; odometer?: number }
  dueDate?: ISODate
  enabled: boolean
  note?: string
}

export type DocumentKind = 'sts' | 'pts' | 'osago' | 'kasko' | 'diagCard' | 'license' | 'other'

export interface VehicleDocument extends Row {
  vehicleId: ID
  kind: DocumentKind
  title?: string
  number?: string
  issuedAt?: ISODate
  validUntil?: ISODate
  note?: string
}

export type TireSeason = 'summer' | 'winter' | 'allSeason'
export type TireSetStatus = 'installed' | 'stored' | 'retired'

export interface TireSet extends Row {
  vehicleId: ID
  season: TireSeason
  brand?: string
  model?: string
  size?: string
  /** '2423' = 24-я неделя 2023 года. */
  dot?: string
  studded?: boolean
  count: number
  purchaseDate?: ISODate
  price?: Kopecks
  storage?: string
  status: TireSetStatus
  treadMm?: number
  note?: string
}

export type OwnerType = 'record' | 'vehicle' | 'document' | 'tireSet'

export interface Attachment extends Row {
  ownerType: OwnerType
  ownerId: ID
  kind: 'photo' | 'pdf'
  name: string
  mime: string
  size: number
  width?: number
  height?: number
  /** Когда оригинал и превью легли на Диск; undefined — файл пока только на устройстве-источнике. */
  uploadedAt?: number
}
