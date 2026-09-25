import { repos } from '../../db/repos'
import type { Vehicle } from '../../domain/types'
import { BottomSheet, SchematicPicker, useToast } from '../../ui'
import { SAVE_FAILED, userMessage } from '../common/errors'
import { schematicChoice, schematicOptions, schematicValue } from './schematicChoice'

export interface SchematicSheetProps {
  vehicle: Vehicle
  open: boolean
  onClose(): void
}

/** Шторка «Картинка машины» с главной и со страницы машины: касание плитки сразу сохраняет выбор. */
export function SchematicSheet({ vehicle, open, onClose }: SchematicSheetProps) {
  const toast = useToast()
  const choose = async (choice: string) => {
    try {
      await repos.vehicles.update(vehicle.id, { schematic: schematicValue(choice) })
      onClose()
    } catch (e) {
      toast.show({ text: userMessage(e, SAVE_FAILED) })
    }
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Картинка машины">
      <SchematicPicker
        label="Какую картинку показывать на главной"
        value={schematicChoice(vehicle.schematic)}
        options={schematicOptions(vehicle)}
        onChange={(choice) => void choose(choice)}
      />
    </BottomSheet>
  )
}
