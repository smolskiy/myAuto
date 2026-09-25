import { IconCloudCheck, IconCloudOff, IconCloudX, IconRefresh, IconWifiOff } from '@tabler/icons-react'
import { cx } from '../../lib/cx'
import styles from './SyncStatusBadge.module.css'

type SyncState = 'off' | 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncStatusBadgeProps {
  state: SyncState
  /** «сегодня в 14:20» — во всплывающей подсказке. */
  lastSyncText?: string
  /** Сколько изменений ещё не отправлено — число на значке. */
  pending?: number
  onClick?(): void
}

const WORD: Record<SyncState, string> = {
  off: 'выключена',
  idle: 'всё сохранено',
  syncing: 'идёт',
  error: 'ошибка',
  offline: 'нет сети',
}

const GLYPH = {
  off: IconCloudOff,
  idle: IconCloudCheck,
  syncing: IconRefresh,
  error: IconCloudX,
  offline: IconWifiOff,
} satisfies Record<SyncState, unknown>

/** Значок в шапке: форма значка и имя говорят о состоянии, цвет лишь дублирует. */
export function SyncStatusBadge({ state, lastSyncText, pending, onClick }: SyncStatusBadgeProps) {
  const Glyph = GLYPH[state]
  const details = [
    lastSyncText && `Последняя синхронизация: ${lastSyncText}`,
    pending ? `Не отправлено изменений: ${pending}` : '',
  ]
    .filter(Boolean)
    .join('. ')
  return (
    <button
      type="button"
      className={cx(styles.badge, styles[state])}
      aria-label={`Синхронизация: ${WORD[state]}`}
      title={details || undefined}
      onClick={onClick}
    >
      <Glyph className={styles.glyph} size={22} stroke={1.75} aria-hidden="true" />
      {!!pending && (
        <span className={styles.pending} aria-hidden="true">
          {pending > 99 ? '99+' : pending}
        </span>
      )}
    </button>
  )
}
