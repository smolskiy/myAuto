// Общие части экранов волны 2b. Экраны импортируют их только отсюда.

// Каркасы страниц
export { Page, type PageProps } from './Page'
export { FormPage, type FormPageProps } from './FormPage'
export { VehicleGate, type VehicleGateProps } from './VehicleGate'
export { useGoBack } from './useGoBack'

// Поля
export { AttachmentsField, type AttachmentsFieldProps } from './AttachmentsField'
export { useDraftAttachments, type DraftAttachments } from './useDraftAttachments'
export { PlacePicker, type PlacePickerProps } from './PlacePicker'
export { MasterPicker, type MasterPickerProps } from './MasterPicker'
export { CatalogItemPicker, type CatalogItemPickerProps } from './CatalogItemPicker'
export { TireSizeField, type TireSizeFieldProps } from './TireSizeField'

// Ошибки для владельца: throw new UserError('Укажите пробег') — текст уйдёт в уведомление
export { UserError } from './errors'

// Хуки
export { useToday } from './useToday'
export { useSoftDelete, type SoftDeleteOptions } from './useSoftDelete'
export { useLookup, type Lookup } from './useLookup'

// Подписи и представление записей
export {
  RECORD_KIND_LABELS,
  SERVICE_TYPE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  DOCUMENT_KIND_LABELS,
  ITEM_GROUP_LABELS,
  PLACE_KIND_LABELS,
  FUEL_TYPE_LABELS,
  TRANSMISSION_LABELS,
  DRIVE_LABELS,
  FLUID_KIND_LABELS,
  UNIT_LABELS,
  TIRE_SEASON_LABELS,
  TIRE_STATUS_LABELS,
} from './labels'
export {
  RECORD_KIND_ICON,
  MISSING_PLACE,
  recordTitle,
  recordSubtitle,
  recordRowProps,
} from './recordPresentation'
