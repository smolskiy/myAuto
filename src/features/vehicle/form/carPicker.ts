import {
  BODY_LABELS,
  findGeneration,
  findMake,
  findModel,
  generationYearsText,
  normalizeName,
  type BodyType,
  type CarMake,
} from '../../../domain/carCatalog'
import type { ComboboxOption } from '../../../ui'
import type { VehicleValues } from './vehicleValues'

/** Название или любое из прежних и русских имён содержит набранное. */
const hit = (names: string[], query: string) => {
  const q = normalizeName(query)
  return !q || names.some((n) => normalizeName(n).includes(q))
}

/** Строк в подсказке марки — не больше: список марок длинный, остальные находятся набором. */
const MAKE_LIMIT = 60

/**
 * Подсказки формы машины из справочника: марки, модели выбранной марки, поколения выбранной модели (подходящие к
 * году — первыми, дальше новые), кузова (кузова поколения — первыми). Справочник ещё грузится — подсказок нет.
 */
export function carPickerOptions(cars: CarMake[] | undefined, v: VehicleValues) {
  const make = cars ? findMake(cars, v.make) : undefined
  const model = make ? findModel(make, v.model) : undefined
  const year = /^\d{4}$/.test(v.year) ? Number(v.year) : undefined
  const fits = (g: { from: number; to: number | null }) =>
    year !== undefined && g.from <= year && (g.to === null || g.to >= year)

  const makeOptions: ComboboxOption[] = (cars ?? [])
    .filter((m) => hit([m.name, ...(m.aka ?? [])], v.make))
    .slice(0, MAKE_LIMIT)
    .map((m) => ({ id: m.name, label: m.name, hint: m.aka?.find((a) => /[а-яё]/i.test(a)) }))

  const modelOptions: ComboboxOption[] = (make?.models ?? [])
    .filter((m) => hit([m.name, ...(m.aka ?? [])], v.model))
    .map((m) => {
      const first = m.generations[0]
      const last = m.generations[m.generations.length - 1]
      const span = first && last ? `${first.from}–${last.to ?? 'н.\u00A0в.'}` : undefined
      return { id: m.name, label: m.name, hint: span }
    })

  const generations = [...(model?.generations ?? [])].sort(
    (a, b) => Number(fits(b)) - Number(fits(a)) || b.from - a.from,
  )
  const generationOptions: ComboboxOption[] = generations
    .filter((g) => hit([g.name, g.code ?? ''], v.generation))
    .map((g) => ({
      id: g.name,
      label: g.name,
      hint: [generationYearsText(g), g.bodies.map((b) => BODY_LABELS[b]).join(', ')]
        .filter(Boolean)
        .join(' · '),
    }))

  const own = model ? (findGeneration(model, v.generation)?.bodies ?? []) : []
  const bodyOrder: BodyType[] = [
    ...own,
    ...(Object.keys(BODY_LABELS) as BodyType[]).filter((b) => !own.includes(b)),
  ]
  const bodyOptions: ComboboxOption[] = bodyOrder
    .filter((b) => hit([BODY_LABELS[b]], v.bodyType))
    .map((b) => ({ id: b, label: BODY_LABELS[b], hint: own.includes(b) ? 'У этого поколения' : undefined }))

  return {
    makeOptions,
    modelOptions,
    generationOptions,
    bodyOptions,
    /** Поколение выбранной модели по названию. */
    generation: (name: string) => (model ? findGeneration(model, name) : undefined),
  }
}
