import { useCallback, useEffect, useId, useState } from 'react'
import { useAttachments } from '../../db/hooks'
import { repos } from '../../db/repos'
import type { Attachment, ID, OwnerType } from '../../domain/types'
import { attachmentStore } from '../../sync/index'
import { useAttachmentUrl, useYandexConnected } from '../../sync/react'
import { saveFile } from '../../sync/saveFile'
import { AttachmentGrid, Lightbox, PhotoPicker, Spinner, useToast } from '../../ui'
import styles from './AttachmentsField.module.css'
import { ADD_FILE_FAILED, SAVE_FAILED, userMessage } from './errors'
import { useSoftDelete } from './useSoftDelete'

export interface AttachmentsFieldProps {
  ownerType: OwnerType
  /** id строки; у новой — `useDraftAttachments(ownerType).ownerId`. */
  ownerId: ID
  /** По умолчанию «Фото и документы». */
  label?: string
}

type UrlState = string | null | undefined

/** Грузит превью одного вложения хуком слоя синхронизации и отдаёт адрес наверх (сам хук и отзывает его). */
function ThumbUrl({ att, onUrl }: { att: Attachment; onUrl(id: ID, url: UrlState): void }) {
  const url = useAttachmentUrl(att, 'thumb')
  useEffect(() => onUrl(att.id, url), [att.id, url, onUrl])
  return null
}

/**
 * `attachmentStore.addFile` по контракту слоя синхронизации бросает обычный Error с русским текстом для
 * владельца («Можно прикрепить фото или PDF», «PDF больше 20 МБ — сожмите файл») — такой текст показываем.
 * Остальное (сбой базы, английские DOMException) — общий текст, подробности в консоль.
 */
const CYRILLIC = /[а-яё]/i
function addFileMessage(e: unknown): string {
  if (e instanceof Error && !(e instanceof DOMException) && CYRILLIC.test(e.message)) return e.message
  return userMessage(e, ADD_FILE_FAILED)
}

/** Фото и PDF строки: превью, «Добавить фото» (камера или галерея), просмотр и удаление с «Отменить». */
export function AttachmentsField({ ownerType, ownerId, label = 'Фото и документы' }: AttachmentsFieldProps) {
  const labelId = useId()
  const toast = useToast()
  const softDelete = useSoftDelete()
  const connected = useYandexConnected()
  const attachments = useAttachments(ownerType, ownerId)
  const [thumbs, setThumbs] = useState<Record<ID, UrlState>>({})
  const [adding, setAdding] = useState(0)
  const [viewing, setViewing] = useState<Attachment | undefined>()
  const [viewerOpen, setViewerOpen] = useState(false)
  const original = useAttachmentUrl(viewing, 'orig')

  const onUrl = useCallback((id: ID, url: UrlState) => {
    setThumbs((prev) => (prev[id] === url ? prev : { ...prev, [id]: url }))
  }, [])

  const addFiles = async (files: File[]) => {
    setAdding((n) => n + files.length)
    for (const file of files) {
      try {
        await attachmentStore.addFile({ ownerType, ownerId }, file)
      } catch (e) {
        toast.show({ text: addFileMessage(e) })
      } finally {
        setAdding((n) => n - 1)
      }
    }
  }

  const find = (id: ID) => attachments?.find((a) => a.id === id)

  const open = (id: ID) => {
    const att = find(id)
    if (!att) return
    setViewing(att)
    setViewerOpen(true)
  }

  const remove = (id: ID) => {
    const att = find(id)
    if (!att) return
    void softDelete({
      remove: () => attachmentStore.remove(att),
      restore: () => repos.attachments.restore(att.id),
      text: att.kind === 'pdf' ? 'Файл удалён' : 'Фото удалено',
    })
  }

  const download = async () => {
    if (!viewing || !original) return
    try {
      await saveFile(await (await fetch(original)).blob(), viewing.name)
    } catch (e) {
      toast.show({ text: userMessage(e, SAVE_FAILED) })
    }
  }

  return (
    <div role="group" aria-labelledby={labelId} className={styles.field}>
      <div className={styles.head}>
        <span id={labelId} className={styles.label}>
          {label}
        </span>
        {adding > 0 && <Spinner size={16} label="Добавляем файл" />}
      </div>
      {attachments?.map((att) => (
        <ThumbUrl key={att.id} att={att} onUrl={onUrl} />
      ))}
      <AttachmentGrid
        items={(attachments ?? []).map((att) => ({
          id: att.id,
          url: thumbs[att.id] ?? null,
          kind: att.kind,
          name: att.name,
          // Без Диска «не отправлено» висело бы на каждом фото — значок только при подключённом Диске.
          pending: connected && !att.uploadedAt,
        }))}
        onOpen={open}
        onRemove={remove}
        picker={<PhotoPicker onFiles={(files) => void addFiles(files)} />}
      />
      {viewing && (
        <Lightbox
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          url={original ?? null}
          name={viewing.name}
          kind={viewing.kind}
          onDownload={original ? () => void download() : undefined}
        />
      )}
    </div>
  )
}
