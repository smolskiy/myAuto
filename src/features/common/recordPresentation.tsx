import {
  IconGasStation,
  IconGauge,
  IconNote,
  IconReceipt,
  IconTool,
  type TablerIcon,
} from '@tabler/icons-react'
import { formatDate, formatKm, formatLiters, formatMoney } from '../../domain/format'
import type { CarRecord, RecordKind } from '../../domain/types'
import type { RecordRowProps } from '../../ui'
import { EXPENSE_CATEGORY_LABELS, RECORD_KIND_LABELS, SERVICE_TYPE_LABELS } from './labels'
import type { Lookup } from './useLookup'

/** Значок типа записи; цвет даёт тон с тем же именем (`kind`) в RecordRow, Icon и ActionSheet. */
export const RECORD_KIND_ICON: Record<RecordKind, TablerIcon> = {
  service: IconTool,
  fuel: IconGasStation,
  expense: IconReceipt,
  odometer: IconGauge,
  note: IconNote,
}

/** Место записи не нашлось даже среди удалённых (строка не дошла синхронизацией или стёрта импортом). */
export const MISSING_PLACE = 'Место удалено'

/** Заголовок строки журнала; пустое название — подпись типа. */
export function recordTitle(r: CarRecord): string {
  switch (r.kind) {
    case 'service':
      return r.title.trim() || SERVICE_TYPE_LABELS[r.serviceType]
    case 'fuel':
      return `${RECORD_KIND_LABELS.fuel} · ${formatLiters(r.liters)}`
    case 'expense':
      return r.title?.trim() || EXPENSE_CATEGORY_LABELS[r.category]
    case 'odometer':
      return RECORD_KIND_LABELS.odometer
    case 'note':
      return r.title.trim() || RECORD_KIND_LABELS.note
  }
}

/**
 * «148 320 км · Автосервис»; части без значения пропускаются. Справочник ещё грузится (`undefined`) —
 * место не показывается, чтобы не мелькало «Место удалено».
 */
export function recordSubtitle(r: CarRecord, lookup: Lookup | undefined): string {
  const parts: string[] = []
  if (r.odometer !== undefined) parts.push(formatKm(r.odometer))
  if (r.placeId && lookup) parts.push(lookup.places.get(r.placeId)?.name ?? MISSING_PLACE)
  return parts.join(' · ')
}

const HAS_AMOUNT: Record<RecordKind, boolean> = {
  service: true,
  fuel: true,
  expense: true,
  odometer: false,
  note: false,
}

/** Пропсы RecordRow из src/ui для записи. Число вложений и нажатие — снаружи (у экрана свои данные). */
export function recordRowProps(
  r: CarRecord,
  lookup: Lookup | undefined,
  opts: { attachments?: number; onClick?(): void } = {},
): RecordRowProps {
  const Glyph = RECORD_KIND_ICON[r.kind]
  return {
    kind: r.kind,
    icon: <Glyph />,
    title: recordTitle(r),
    subtitle: recordSubtitle(r, lookup) || undefined,
    amount: HAS_AMOUNT[r.kind] && r.total ? formatMoney(r.total) : undefined,
    date: formatDate(r.date),
    attachments: opts.attachments,
    onClick: opts.onClick,
  }
}
