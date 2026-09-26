import type { RecordFormValues } from './useRecordForm'

/**
 * В ТО есть что-то из подробностей — строки работ и запчастей, «Делал сам», мастер или гарантия: форма открывается
 * сразу с ними, а не короткой (название, тип, стоимость).
 */
export function hasServiceDetails(v: RecordFormValues): boolean {
  return (
    v.works.length > 0 ||
    v.parts.length > 0 ||
    v.diy ||
    !!v.masterId ||
    !!v.warrantyUntilDate ||
    v.warrantyUntilKm !== undefined
  )
}
