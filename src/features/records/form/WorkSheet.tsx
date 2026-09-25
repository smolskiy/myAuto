import { useState } from 'react'
import type { ID, WorkLine } from '../../../domain/types'
import { BottomSheet, Button, MoneyField, TextField } from '../../../ui'
import { CatalogItemPicker, MasterPicker, useLookup } from '../../common'
import styles from './RecordForm.module.css'
import { BLANK_LINE, isBlankLine, lineName } from './serviceLines'

export interface WorkSheetProps {
  open: boolean
  /** Строка на правку; шторку пересоздают ключом по id строки. */
  line: WorkLine
  /** Место записи: мастер работы выбирается из его мастеров. */
  placeId?: ID
  /** «Делал сам» — мастера у работы нет. */
  diy: boolean
  /** Закрытие любым способом («Готово», крестик, жест): строка сохраняется в список. */
  onDone(line: WorkLine): void
}

/** Строка работы: узел, название, цена и мастер, если работу делал не мастер всей записи. */
export function WorkSheet({ open, line, placeId, diy, onDone }: WorkSheetProps) {
  const [draft, setDraft] = useState<WorkLine>(line)
  const [itemQuery, setItemQuery] = useState('')
  const [error, setError] = useState<string>()
  const lookup = useLookup()
  const itemName = (id?: ID) => (id ? lookup?.catalog.get(id)?.name : undefined)
  const finished = (): WorkLine => ({
    ...draft,
    name: lineName(draft, itemName(draft.itemId), itemQuery),
    masterId: diy ? undefined : draft.masterId,
  })
  // Крестик и жест — отмена пустой строки; «Готово» с пустой строкой — подсказка, а не молчаливый выброс.
  const close = () => onDone(finished())
  const done = () => {
    const line = finished()
    if (isBlankLine(line)) setError(BLANK_LINE)
    else onDone(line)
  }

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title="Работа"
      footer={
        <Button block onClick={done}>
          Готово
        </Button>
      }
    >
      <div className={styles.sheetBody}>
        <CatalogItemPicker
          allowCreate
          error={error}
          onQueryChange={(q) => {
            setItemQuery(q)
            setError(undefined)
          }}
          value={draft.itemId}
          onChange={(itemId, item) => {
            setError(undefined)
            setDraft((d) => ({
              ...d,
              itemId,
              name: !d.name.trim() || d.name === itemName(d.itemId) ? (item?.name ?? '') : d.name,
            }))
          }}
        />
        <TextField
          label="Название"
          value={draft.name}
          onChange={(e) => {
            setDraft((d) => ({ ...d, name: e.target.value }))
            setError(undefined)
          }}
        />
        <MoneyField
          label="Цена"
          value={draft.price}
          onChange={(price) => setDraft((d) => ({ ...d, price }))}
        />
        {!diy && (
          <MasterPicker
            placeId={placeId}
            value={draft.masterId}
            onChange={(masterId) => setDraft((d) => ({ ...d, masterId }))}
            hint="Если не мастер всей записи"
          />
        )}
      </div>
    </BottomSheet>
  )
}
