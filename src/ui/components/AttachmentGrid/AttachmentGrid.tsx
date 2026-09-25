import { IconCloudUpload, IconFileTypePdf, IconX } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { Skeleton } from '../Skeleton/Skeleton'
import styles from './AttachmentGrid.module.css'

export interface AttachmentThumb {
  id: string
  /** null — превью ещё грузится (скелетон). */
  url: string | null
  kind: 'photo' | 'pdf'
  name: string
  /** Ещё не отправлено на Диск. */
  pending?: boolean
}

export interface AttachmentGridProps {
  items: AttachmentThumb[]
  onOpen(id: string): void
  onRemove?(id: string): void
  /** Последняя плитка — обычно `<PhotoPicker />`. */
  picker?: ReactNode
}

/** Сетка превью вложений по три в ряд. */
export function AttachmentGrid({ items, onOpen, onRemove, picker }: AttachmentGridProps) {
  return (
    <ul className={styles.grid}>
      {items.map((it) => (
        <li key={it.id} className={styles.cell}>
          <button
            type="button"
            className={styles.thumb}
            aria-label={`Открыть «${it.name}»`}
            onClick={() => onOpen(it.id)}
          >
            {it.kind === 'pdf' ? (
              <span className={styles.pdf}>
                <IconFileTypePdf size={32} stroke={1.5} aria-hidden="true" />
                <span className={styles.pdfName}>{it.name}</span>
              </span>
            ) : it.url ? (
              <img className={styles.img} src={it.url} alt="" loading="lazy" decoding="async" />
            ) : (
              <Skeleton width="100%" height="100%" radius="md" />
            )}
          </button>
          {it.pending && (
            <span className={styles.pending} title="Не отправлено на Диск">
              <IconCloudUpload size={16} stroke={2} aria-hidden="true" />
              <span className="visually-hidden">Не отправлено</span>
            </span>
          )}
          {onRemove && (
            <button
              type="button"
              className={styles.remove}
              aria-label={`Удалить «${it.name}»`}
              onClick={() => onRemove(it.id)}
            >
              <IconX size={16} stroke={2.5} aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
      {picker && <li className={styles.cell}>{picker}</li>}
    </ul>
  )
}
