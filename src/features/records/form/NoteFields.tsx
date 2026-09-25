import { TextArea, TextField } from '../../../ui'
import { CommonFields, type FieldsProps } from './CommonFields'

/** Заметка: название и текст; пробег необязателен. */
export function NoteFields({ form, ctx, suggestDate }: FieldsProps & { suggestDate: boolean }) {
  const { values, errors, set } = form
  return (
    <>
      <TextField
        label="Название"
        value={values.title}
        onChange={(e) => set({ title: e.target.value })}
        error={errors.title}
      />
      <TextArea label="Текст" value={values.note} rows={4} onChange={(e) => set({ note: e.target.value })} />
      <CommonFields form={form} ctx={ctx} suggestDate={suggestDate} />
    </>
  )
}
