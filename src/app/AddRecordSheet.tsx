import { useNavigate } from 'react-router'
import type { RecordKind } from '../domain/types'
import { RECORD_KIND_LABELS } from '../features/common/labels'
import { RECORD_KIND_ICON } from '../features/common/recordPresentation'
import { ActionSheet } from '../ui'

const KINDS = Object.keys(RECORD_KIND_LABELS) as RecordKind[]

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
      actions={KINDS.map((kind) => {
        const Glyph = RECORD_KIND_ICON[kind]
        return {
          key: kind,
          label: RECORD_KIND_LABELS[kind],
          icon: <Glyph />,
          tone: kind,
          onSelect: () => navigate(`/record/new/${kind}`),
        }
      })}
    />
  )
}
