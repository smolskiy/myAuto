// Публичный API дизайн-системы. Экраны импортируют только отсюда.
export { ThemeProvider, useTheme, THEME_BG, THEME_STORAGE_KEY } from './theme'
export type { ThemePreference, ResolvedTheme } from './theme'
export type { Tone, RecordKindTone, StatusState } from './types'

// Базовые элементы
export { Button, type ButtonProps } from './components/Button/Button'
export { IconButton, type IconButtonProps } from './components/IconButton/IconButton'
export { Icon, type IconProps } from './components/Icon/Icon'
export { Card, type CardProps } from './components/Card/Card'
export { Divider, type DividerProps } from './components/Divider/Divider'
export { Badge, type BadgeProps } from './components/Badge/Badge'
export { StatusPill, type StatusPillProps } from './components/StatusPill/StatusPill'
export { Chip, type ChipProps } from './components/Chip/Chip'
export { SegmentedControl, type SegmentedControlProps } from './components/SegmentedControl/SegmentedControl'
export { ProgressBar, type ProgressBarProps } from './components/ProgressBar/ProgressBar'
export { Skeleton, type SkeletonProps } from './components/Skeleton/Skeleton'
export { EmptyState, type EmptyStateProps } from './components/EmptyState/EmptyState'
export { Spinner, type SpinnerProps } from './components/Spinner/Spinner'

// Списки и карточки
export { ListGroup, type ListGroupProps } from './components/ListGroup/ListGroup'
export { ListItem, type ListItemProps } from './components/ListItem/ListItem'
export { SectionHeader, type SectionHeaderProps } from './components/SectionHeader/SectionHeader'
export { StatTile, type StatTileProps } from './components/StatTile/StatTile'
export { RecordRow, type RecordRowProps } from './components/RecordRow/RecordRow'
export { MonthHeader, type MonthHeaderProps } from './components/MonthHeader/MonthHeader'
export { ReminderCard, type ReminderCardProps } from './components/ReminderCard/ReminderCard'
export { VehicleCard, type VehicleCardProps } from './components/VehicleCard/VehicleCard'
export {
  VehicleSchematic,
  type VehicleSchematicProps,
  type SchematicMark,
  type SchematicModel,
  type SchematicZone,
} from './components/VehicleSchematic/VehicleSchematic'

// Поля ввода
export { Field, type FieldProps } from './components/Field/Field'
export { TextField, type TextFieldProps } from './components/TextField/TextField'
export { TextArea, type TextAreaProps } from './components/TextArea/TextArea'
export { NumberField, type NumberFieldProps } from './components/NumberField/NumberField'
export { MoneyField, type MoneyFieldProps } from './components/MoneyField/MoneyField'
export { DateField, type DateFieldProps } from './components/DateField/DateField'
export { OdometerField, type OdometerFieldProps } from './components/OdometerField/OdometerField'
export { Select, type SelectProps } from './components/Select/Select'
export { Combobox, type ComboboxProps, type ComboboxOption } from './components/Combobox/Combobox'
export { Switch, type SwitchProps } from './components/Switch/Switch'
export { Checkbox, type CheckboxProps } from './components/Checkbox/Checkbox'
export { Rating, type RatingProps } from './components/Rating/Rating'
export { SearchField, type SearchFieldProps } from './components/SearchField/SearchField'

// Навигация и оверлеи
export { AppBar, type AppBarProps } from './components/AppBar/AppBar'
export { BottomTabBar, type BottomTabBarProps, type TabItem } from './components/BottomTabBar/BottomTabBar'
export { BottomSheet, type BottomSheetProps } from './components/BottomSheet/BottomSheet'
export {
  ActionSheet,
  type ActionSheetProps,
  type ActionSheetAction,
} from './components/ActionSheet/ActionSheet'
export { Dialog, type DialogProps } from './components/Dialog/Dialog'
export { ToastProvider, useToast, type ToastApi, type ToastOptions } from './components/Toast/Toast'
export { VehicleSwitcher, type VehicleSwitcherProps } from './components/VehicleSwitcher/VehicleSwitcher'
export { SyncStatusBadge, type SyncStatusBadgeProps } from './components/SyncStatusBadge/SyncStatusBadge'

// Жесты, вложения, строки работ/запчастей, графики
export { SwipeRow, type SwipeRowProps, type SwipeAction } from './components/SwipeRow/SwipeRow'
export { PullToRefresh, type PullToRefreshProps } from './components/PullToRefresh/PullToRefresh'
export { PhotoPicker, type PhotoPickerProps } from './components/PhotoPicker/PhotoPicker'
export {
  AttachmentGrid,
  type AttachmentGridProps,
  type AttachmentThumb,
} from './components/AttachmentGrid/AttachmentGrid'
export { Lightbox, type LightboxProps } from './components/Lightbox/Lightbox'
export { RepeatableList, type RepeatableListProps } from './components/RepeatableList/RepeatableList'
export { LineItemRow, type LineItemRowProps } from './components/LineItemRow/LineItemRow'
export { ChartCard, type ChartCardProps } from './components/ChartCard/ChartCard'
export { chartTheme, type ChartColors } from './chartTheme'
