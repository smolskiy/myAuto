import { IconDownload, IconFileTypePdf, IconX } from '@tabler/icons-react'
import { useId } from 'react'
import { Button } from '../Button/Button'
import { IconButton } from '../IconButton/IconButton'
import { ModalLayer } from '../Overlay/Overlay'
import { Spinner } from '../Spinner/Spinner'
import styles from './Lightbox.module.css'

export interface LightboxProps {
  open: boolean
  onClose(): void
  /** null — оригинал ещё загружается. */
  url: string | null
  name: string
  kind: 'photo' | 'pdf'
  onDownload?(): void
}

/** Просмотр вложения на весь экран, всегда в тёмной теме. PDF — карточка с кнопкой «Скачать». */
export function Lightbox({ open, onClose, url, name, kind, onDownload }: LightboxProps) {
  const titleId = useId()
  return (
    <ModalLayer
      open={open}
      onDismiss={onClose}
      labelledBy={titleId}
      placement="fullscreen"
      theme="dark"
      panelClassName={styles.lightbox}
    >
      <div className={styles.top}>
        <IconButton label="Закрыть" icon={<IconX />} onClick={onClose} />
        <h2 id={titleId} className={styles.name}>
          {name}
        </h2>
        {onDownload && <IconButton label="Скачать" icon={<IconDownload />} onClick={onDownload} />}
      </div>
      <div className={styles.stage}>
        {!url ? (
          <Spinner size={24} label="Загрузка" />
        ) : kind === 'photo' ? (
          <img className={styles.img} src={url} alt={name} />
        ) : (
          <div className={styles.pdf}>
            <IconFileTypePdf size={56} stroke={1.25} aria-hidden="true" />
            <p className={styles.pdfName}>{name}</p>
            {onDownload && (
              <Button variant="secondary" icon={<IconDownload />} onClick={onDownload}>
                Скачать
              </Button>
            )}
          </div>
        )}
      </div>
    </ModalLayer>
  )
}
