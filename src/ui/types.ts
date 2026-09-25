/** Смысловой тон элемента: нейтральный, акцент или статус напоминания. */
export type Tone = 'neutral' | 'accent' | 'ok' | 'soon' | 'overdue'

/** Тон типа записи журнала — цвет значка в кружке-подложке. */
export type RecordKindTone = 'service' | 'fuel' | 'expense' | 'odometer' | 'note'

/** Статус напоминания или срока. */
export type StatusState = 'ok' | 'soon' | 'overdue' | 'unknown'
