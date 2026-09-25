import { useMasters } from '../../db/hooks'
import { repos } from '../../db/repos'
import type { ID } from '../../domain/types'
import { Combobox, useToast } from '../../ui'
import { SAVE_FAILED, userMessage } from './errors'
import { matches, usePickerQuery } from './pickerQuery'
import { useLookup } from './useLookup'

export interface MasterPickerProps {
  /** Место записи: предлагаются его мастера, новый мастер создаётся в нём. Без места — все мастера. */
  placeId?: ID
  value?: ID
  onChange(id?: ID): void
  /** По умолчанию «Мастер». */
  label?: string
  hint?: string
  error?: string
}

/** Комбобокс мастеров с созданием нового. */
export function MasterPicker({ placeId, value, onChange, label = 'Мастер', hint, error }: MasterPickerProps) {
  const toast = useToast()
  const masters = useMasters(placeId)
  const lookup = useLookup()
  const selected = value ? (masters?.find((m) => m.id === value) ?? lookup?.masters.get(value)) : undefined
  const [query, setQuery] = usePickerQuery(selected?.id, selected?.name)

  const options = (masters ?? [])
    .filter((m) => matches(m.name, query))
    .map((m) => ({
      id: m.id,
      label: m.name,
      // Без места в подсказке — где работает, чтобы различать тёзок.
      hint: m.specialization ?? (!placeId && m.placeId ? lookup?.places.get(m.placeId)?.name : undefined),
    }))

  const create = async (name: string) => {
    try {
      const master = await repos.masters.create({ name, placeId })
      onChange(master.id)
    } catch (e) {
      toast.show({ text: userMessage(e, SAVE_FAILED) })
    }
  }

  return (
    <Combobox
      label={label}
      value={selected ? { id: selected.id, label: selected.name } : null}
      options={options}
      query={query}
      onQueryChange={setQuery}
      onSelect={(o) => onChange(o?.id)}
      onCreate={(name) => void create(name)}
      hint={hint}
      error={error}
    />
  )
}
