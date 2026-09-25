import { useId, useRef } from 'react'
import { Button } from '../Button/Button'
import { ModalLayer } from '../Overlay/Overlay'
import styles from './Dialog.module.css'

export interface DialogProps {
  open: boolean
  title: string
  text?: string
  confirmLabel: string
  /** По умолчанию «Отменить». */
  cancelLabel?: string
  /** Разрушительное действие: кнопка подтверждения красная, фокус — на отмене. */
  danger?: boolean
  onConfirm(): void
  onCancel(): void
}

/** Подтверждение по центру экрана (alertdialog). Escape и нажатие на фон — отмена. */
export function Dialog({ open, title, text, confirmLabel, cancelLabel = 'Отменить', danger, onConfirm, onCancel }: DialogProps) {
  const titleId = useId()
  const textId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  return (
    <ModalLayer
      open={open}
      onDismiss={onCancel}
      role="alertdialog"
      labelledBy={titleId}
      describedBy={text ? textId : undefined}
      initialFocus={cancelRef}
      placement="center"
      panelClassName={styles.dialog}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      {text && (
        <p id={textId} className={styles.text}>
          {text}
        </p>
      )}
      <div className={styles.actions}>
        <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </ModalLayer>
  )
}
