import type { Attachment, ID, OwnerType } from '../domain/types'
import type { TableName } from '../domain/snapshot'

/** Замороженные интерфейсы слоя синхронизации. Экраны работают только через них. */

export type SyncState = 'off' | 'idle' | 'syncing' | 'error' | 'offline'

export interface SyncStatus {
  state: SyncState
  lastSyncAt?: number
  /** Текст для пользователя, только при state = 'error'. */
  error?: string
  /** Сколько файлов вложений ждут загрузки на Диск. */
  pendingUploads: number
}

export interface SyncEngine {
  getStatus(): SyncStatus
  subscribe(cb: (status: SyncStatus) => void): () => void
  /** Запустить цикл сейчас; если цикл уже идёт — дождаться его. Ошибки не бросает, а пишет в статус. */
  syncNow(reason?: string): Promise<void>
  /** Подписаться на триггеры: локальные изменения, возврат в приложение, online, таймер 5 мин. */
  start(): void
  stop(): void
}

export interface YandexAuth {
  isConnected(): boolean
  getClientId(): string | null
  setClientId(clientId: string): void
  /** URL implicit flow (response_type=token) с redirect_uri на oauth.html. */
  loginUrl(): string
  /** URL страницы Яндекса, показывающей код подтверждения (запасной вход). */
  verificationCodeUrl(): string
  connectWithToken(token: string): Promise<void>
  connectWithCode(code: string): Promise<void>
  disconnect(): Promise<void>
  /** Текст последней неудачи входа (через oauth.html или по коду) для экрана; null — ошибки нет. Сбрасывается новым входом. */
  getLoginError(): string | null
  /** Сообщает об изменении подключения и ошибки входа — для экранов и движка синхронизации. */
  subscribe(cb: () => void): () => void
}

export interface AttachmentStore {
  /** Сжимает фото, сохраняет строку Attachment и файлы в blobs (pending), планирует загрузку. */
  addFile(owner: { ownerType: OwnerType; ownerId: ID }, file: File): Promise<Attachment>
  /** object URL превью или null, если его нет ни локально, ни на Диске. */
  getThumbUrl(att: Attachment): Promise<string | null>
  getOriginalUrl(att: Attachment): Promise<string | null>
  /** Мягко удаляет строку; файлы на Диске удаляются при следующей синхронизации. */
  remove(att: Attachment): Promise<void>
  pendingCount(): Promise<number>
}

export interface ImportPreview {
  exportedAt: number
  counts: Record<TableName, number>
}

export interface BackupService {
  exportJson(): Promise<Blob>
  /** Бросает SnapshotError с текстом для пользователя. */
  previewImport(file: File): Promise<ImportPreview>
  importJson(file: File, mode: 'merge' | 'replace'): Promise<void>
  exportExcel(): Promise<Blob>
}
