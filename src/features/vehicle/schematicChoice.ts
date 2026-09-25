import type { Vehicle } from '../../domain/types'
import { isSchematicModel, SCHEMATIC_ART, SCHEMATIC_MODELS, type SchematicPickerOption } from '../../ui'
import { autoSchematic } from '../home/schematic'

/** Плитка «Автоматически»; в машине — отсутствие поля `schematic`. */
export const AUTO = 'auto'
/** Плитка «Без картинки»; в машине — `schematic: 'none'`. */
export const NO_SCHEMATIC = 'none'

type MatchFields = Pick<Vehicle, 'make' | 'model' | 'year' | 'generation' | 'bodyType'>

/** Плитки выбора: «Автоматически» с тем, что подобралось по марке и модели, все картинки, «Без картинки». */
export function schematicOptions(fields: MatchFields): SchematicPickerOption[] {
  const auto = autoSchematic(fields)
  return [
    {
      value: AUTO,
      label: 'Автоматически',
      hint: auto ? SCHEMATIC_ART[auto].label : 'Нет для модели',
      ...(auto && { model: auto }),
    },
    ...SCHEMATIC_MODELS.map((model) => ({ value: model, label: SCHEMATIC_ART[model].label, model })),
    { value: NO_SCHEMATIC, label: 'Без картинки' },
  ]
}

/** Отмеченная плитка по полю машины: неизвестный id (картинку убрали из приложения) работает как подбор. */
export const schematicChoice = (schematic: string | undefined) =>
  isSchematicModel(schematic) || schematic === NO_SCHEMATIC ? schematic : AUTO

/** Значение поля машины по плитке: «Автоматически» — поля нет. */
export const schematicValue = (choice: string) => (choice === AUTO ? undefined : choice)
