import type { DeadlineStatus } from '../../domain/calc/reminders'
import { formatDaysLeft } from '../../domain/format'
import type { DocumentKind, VehicleDocument } from '../../domain/types'
import type { StatusState } from '../../ui'
import { DOCUMENT_KIND_LABELS } from '../common'

// Порядок выбора — как в списке документов (`useDocuments`): полисы и техосмотр чаще, прочее реже.
const ORDER: DocumentKind[] = ['osago', 'kasko', 'diagCard', 'sts', 'pts', 'license', 'other']

/** Подпись вида в выборе: у `other` — «Другое» (у самого документа без названия — «Документ»). */
export const DOCUMENT_KIND_OPTIONS = ORDER.map((k) => ({
  value: k,
  label: k === 'other' ? 'Другое' : DOCUMENT_KIND_LABELS[k],
}))

/** «ОСАГО», «Гарантийный талон» (своё название у «Другое»). */
export function documentTitle(doc: Pick<VehicleDocument, 'kind' | 'title'>): string {
  return doc.kind === 'other'
    ? doc.title?.trim() || DOCUMENT_KIND_LABELS.other
    : DOCUMENT_KIND_LABELS[doc.kind]
}

export interface DocumentStatus {
  state: StatusState
  /** Своя подпись плашки; нет — подпись состояния по умолчанию. */
  label?: string
  /** Дней до конца срока (отрицательное — просрочен); у заменённого — нет. */
  remainingDays?: number
}

/**
 * Статус документа по срокам машины (`useDeadlines`): документ — действующий срок своего вида → его состояние;
 * есть более поздний документ или полис того же вида → «Заменён» (просроченный старый полис не пугает);
 * без срока действия — undefined (плашки нет).
 */
export function documentStatus(
  doc: VehicleDocument,
  deadlines: DeadlineStatus[],
): DocumentStatus | undefined {
  if (!doc.validUntil) return undefined
  const own = deadlines.find((d) => d.source.type === 'document' && d.source.id === doc.id)
  if (own) return { state: own.state, remainingDays: own.remainingDays }
  return { state: 'unknown', label: 'Заменён' }
}

/** «осталось 12 дней», «последний день», «просрочено на 3 дня». */
export function daysLeftText(days: number): string {
  if (days === 0) return 'последний день'
  return days > 0 ? `осталось ${formatDaysLeft(days)}` : formatDaysLeft(days)
}
