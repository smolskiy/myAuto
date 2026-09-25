import { IconGasStation, IconGauge, IconNote, IconReceipt, IconTool } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import type { RecordKind } from '../domain/types'
import { ActionSheet } from '../ui'

const KINDS: { kind: RecordKind; label: string; icon: ReactNode }[] = [
  { kind: 'service', label: 'ТО и ремонт', icon: <IconTool /> },
  { kind: 'fuel', label: 'Заправка', icon: <IconGasStation /> },
  { kind: 'expense', label: 'Расход', icon: <IconReceipt /> },
  { kind: 'odometer', label: 'Пробег', icon: <IconGauge /> },
  { kind: 'note', label: 'Заметка', icon: <IconNote /> },
]

export interface AddRecordSheetProps {
  open: boolean
  onClose(): void
}

/** Выбор типа новой записи из кнопки «+» нижней панели. */
export function AddRecordSheet({ open, onClose }: AddRecordSheetProps) {
  const navigate = useNavigate()
  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      title="Новая запись"
      actions={KINDS.map(({ kind, label, icon }) => ({
        key: kind,
        label,
        icon,
        tone: kind,
        onSelect: () => navigate(`/record/new/${kind}`),
      }))}
    />
  )
}
