import { Badge, StatusPill } from '../../ui'
import type { DocumentStatus } from './documentStatus'

/** Плашка срока: состояние срока или нейтральная отметка («Заменён»). */
export function StatusMark({ status }: { status: DocumentStatus }) {
  return status.label ? <Badge>{status.label}</Badge> : <StatusPill state={status.state} />
}
