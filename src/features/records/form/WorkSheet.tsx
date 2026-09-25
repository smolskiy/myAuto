import { useState } from 'react'
import type { ID, WorkLine } from '../../../domain/types'
import { BottomSheet, Button, MoneyField, TextField } from '../../../ui'
import { CatalogItemPicker, MasterPicker, useLookup } from '../../common'
import styles from './RecordForm.module.css'

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
  const lookup = useLookup()
  const itemName = (id?: ID) => (id ? lookup?.catalog.get(id)?.name : undefined)
  const done = () =>
    onDone({
      ...draft,
      name: draft.name.trim() || itemName(draft.itemId) || '',
      masterId: diy ? undefined : draft.masterId,
    })

  return (
    <BottomSheet
      open={open}
      onClose={done}
      title="Работа"
      footer={
        <Button block onClick={done}>
          Готово
        </Button>
      }
    >
      <div className={styles.sheetBody}>
        <CatalogItemPicker
          value={draft.itemId}
          onChange={(itemId, item) =>
            setDraft((d) => ({
              ...d,
              itemId,
              name: !d.name.trim() || d.name === itemName(d.itemId) ? (item?.name ?? '') : d.name,
            }))
          }
        />
        <TextField
          label="Название"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
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
