import { IconHistory } from '@tabler/icons-react'
import { useState } from 'react'
import { useBrandSuggestions, useLastPart } from '../../../db/hooks'
import { lineTotal } from '../../../domain/calc/lines'
import { formatMoney } from '../../../domain/format'
import type { ID, PartLine, PartUnit } from '../../../domain/types'
import {
  BottomSheet,
  Button,
  Combobox,
  ListGroup,
  MoneyField,
  NumberField,
  Select,
  Switch,
  TextField,
} from '../../../ui'
import { CatalogItemPicker, PlacePicker, UNIT_LABELS, useLookup } from '../../common'
import { lastPartText } from '../lineText'
import styles from './RecordForm.module.css'
import {
  applyLastPart,
  BLANK_LINE,
  isBlankLine,
  resolveLine,
  matchesLastPart,
  type PartDraft,
} from './serviceLines'

const UNIT_OPTIONS = (Object.keys(UNIT_LABELS) as PartUnit[]).map((value) => ({
  value,
  label: UNIT_LABELS[value],
}))

export interface PartSheetProps {
  open: boolean
  /** Строка на правку; шторку пересоздают ключом по id строки. */
  line: PartDraft
  vehicleId: ID
  /** Закрытие любым способом («Готово», крестик, жест): строка сохраняется в список. */
  onDone(line: PartLine): void
}

/** Готовая строка (узел и название — `resolveLine`): количество по умолчанию 1. */
function finish(d: PartDraft): PartLine {
  return {
    ...d,
    brand: d.brand?.trim() || undefined,
    partNumber: d.partNumber?.trim() || undefined,
    qty: d.qty && d.qty > 0 ? d.qty : 1,
    supplierPlaceId: d.ownPart ? d.supplierPlaceId : undefined,
  }
}

/** Строка запчасти: узел → подсказка «в прошлый раз» → бренд, артикул, количество, цена, где купил. */
export function PartSheet({ open, line, vehicleId, onDone }: PartSheetProps) {
  const [draft, setDraft] = useState<PartDraft>(line)
  const [itemQuery, setItemQuery] = useState('')
  const [error, setError] = useState<string>()
  const lookup = useLookup()
  const last = useLastPart(vehicleId, draft.itemId)
  const brands = useBrandSuggestions(draft.brand ?? '')
  const patch = (p: Partial<PartDraft>) => setDraft((d) => ({ ...d, ...p }))
  const itemName = (id?: ID) => (id ? lookup?.catalog.get(id)?.name : undefined)

  const suggestion = last && !matchesLastPart(draft, last.line) ? lastPartText(last.line) : null
  // Крестик и жест — отмена пустой строки; «Готово» с пустой строкой — подсказка, а не молчаливый выброс.
  const close = () => onDone(finish(resolveLine(draft, '', lookup?.catalog)))
  const done = () => {
    const line = finish(resolveLine(draft, itemQuery, lookup?.catalog))
    if (isBlankLine(line)) setError(BLANK_LINE)
    else onDone(line)
  }
  const unit = UNIT_LABELS[draft.unit]
  const sum =
    draft.unitPrice !== undefined && draft.qty && draft.qty !== 1
      ? `Сумма: ${formatMoney(lineTotal({ ...draft, qty: draft.qty }))}`
      : undefined

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title="Запчасть"
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
              // Название шло от прежнего узла (или пустое) — берём имя нового узла.
              name: !d.name.trim() || d.name === itemName(d.itemId) ? (item?.name ?? '') : d.name,
            }))
          }}
        />
        {suggestion && last && (
          <button
            type="button"
            className={styles.suggestion}
            onClick={() => setDraft((d) => applyLastPart(d, last.line))}
          >
            <IconHistory size={20} stroke={1.75} aria-hidden="true" />
            <span>{suggestion}</span>
          </button>
        )}
        <TextField
          label="Название"
          value={draft.name}
          onChange={(e) => {
            patch({ name: e.target.value })
            setError(undefined)
          }}
        />
        <Combobox
          label="Бренд"
          value={null}
          options={brands.map((b) => ({ id: b, label: b }))}
          query={draft.brand ?? ''}
          onQueryChange={(brand) => patch({ brand })}
          onSelect={(o) => o && patch({ brand: o.label })}
        />
        <TextField
          label="Артикул"
          value={draft.partNumber ?? ''}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => patch({ partNumber: e.target.value })}
        />
        <div className={styles.pair}>
          <NumberField
            label="Количество"
            value={draft.qty}
            onChange={(qty) => patch({ qty })}
            decimals={2}
            min={0}
          />
          <Select
            label="Единица"
            value={draft.unit}
            options={UNIT_OPTIONS}
            onChange={(u) => patch({ unit: u })}
          />
        </div>
        <MoneyField
          label={`Цена за ${unit}`}
          value={draft.unitPrice}
          onChange={(unitPrice) => patch({ unitPrice })}
          hint={sum}
        />
        <ListGroup>
          <Switch
            label="Купил сам"
            hint="Не запчасть сервиса"
            checked={draft.ownPart}
            onChange={(ownPart) => patch({ ownPart })}
          />
        </ListGroup>
        {draft.ownPart && (
          <PlacePicker
            label="Где купил"
            kinds={['parts']}
            value={draft.supplierPlaceId}
            onChange={(supplierPlaceId) => patch({ supplierPlaceId })}
          />
        )}
      </div>
    </BottomSheet>
  )
}
