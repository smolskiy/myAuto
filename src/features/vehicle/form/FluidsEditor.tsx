import { useState } from 'react'
import { formatLiters } from '../../../domain/format'
import type { Fluid, FluidKind } from '../../../domain/types'
import { BottomSheet, Button, LineItemRow, NumberField, RepeatableList, Select, TextField } from '../../../ui'
import { FLUID_KIND_LABELS } from '../../common'
import styles from './VehicleForm.module.css'

const KIND_OPTIONS = (Object.keys(FLUID_KIND_LABELS) as FluidKind[]).map((value) => ({
  value,
  label: FLUID_KIND_LABELS[value],
}))

export interface FluidsEditorProps {
  value: Fluid[]
  onChange(fluids: Fluid[]): void
}

type Editing = { index: number | null; fluid: Fluid; open: boolean; key: number }

/** Шторка жидкости: вид, спецификация, объём. Закрытие любым способом сохраняет строку. */
function FluidSheet({ editing, onDone }: { editing: Editing; onDone(f: Fluid): void }) {
  const [draft, setDraft] = useState<Fluid>(editing.fluid)
  const done = () =>
    onDone({
      kind: draft.kind,
      ...(draft.spec?.trim() ? { spec: draft.spec.trim() } : {}),
      ...(draft.volumeL !== undefined ? { volumeL: draft.volumeL } : {}),
      ...(draft.note?.trim() ? { note: draft.note.trim() } : {}),
    })
  return (
    <BottomSheet
      open={editing.open}
      onClose={done}
      title="Жидкость"
      footer={
        <Button block onClick={done}>
          Готово
        </Button>
      }
    >
      <div className={styles.sheetBody}>
        <Select
          label="Вид"
          value={draft.kind}
          options={KIND_OPTIONS}
          onChange={(kind) => setDraft((d) => ({ ...d, kind }))}
        />
        <TextField
          label="Спецификация"
          placeholder="VW 504.00 5W-30"
          value={draft.spec ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, spec: e.target.value }))}
        />
        <NumberField
          label="Объём"
          unit="л"
          decimals={2}
          min={0}
          value={draft.volumeL}
          onChange={(volumeL) => setDraft((d) => ({ ...d, volumeL }))}
        />
      </div>
    </BottomSheet>
  )
}

/** Жидкости машины: что и сколько заливать — список строк, строка правится в шторке. */
export function FluidsEditor({ value, onChange }: FluidsEditorProps) {
  const [editing, setEditing] = useState<Editing | null>(null)
  const [seq, setSeq] = useState(0)

  const open = (index: number | null, fluid: Fluid) => {
    setSeq((n) => n + 1)
    setEditing({ index, fluid, open: true, key: seq + 1 })
  }

  const done = (fluid: Fluid) => {
    if (!editing) return
    const { index } = editing
    setEditing({ ...editing, open: false })
    onChange(index === null ? [...value, fluid] : value.map((f, i) => (i === index ? fluid : f)))
  }

  return (
    <>
      <RepeatableList
        title="Жидкости"
        addLabel="Добавить жидкость"
        onAdd={() => open(null, { kind: 'engineOil' })}
      >
        {value.map((f, i) => (
          <LineItemRow
            key={`${f.kind}-${i}`}
            title={FLUID_KIND_LABELS[f.kind]}
            meta={[f.spec, f.volumeL !== undefined ? formatLiters(f.volumeL) : undefined]
              .filter(Boolean)
              .join(' · ')}
            onEdit={() => open(i, f)}
            onRemove={() => onChange(value.filter((_, j) => j !== i))}
          />
        ))}
      </RepeatableList>
      {editing && <FluidSheet key={editing.key} editing={editing} onDone={done} />}
    </>
  )
}
