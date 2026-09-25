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
