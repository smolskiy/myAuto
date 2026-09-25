import { useId, type ReactNode } from 'react'
import { cx } from '../../lib/cx'
import tones from '../../tones.module.css'
import type { RecordKindTone } from '../../types'
import { Button } from '../Button/Button'
import { ModalLayer } from '../Overlay/Overlay'
import styles from './ActionSheet.module.css'

export interface ActionSheetAction {
  key: string
  label: string
  icon?: ReactNode
  tone?: RecordKindTone | 'danger'
  onSelect(): void
}

export interface ActionSheetProps {
  open: boolean
  onClose(): void
  title?: string
  actions: ActionSheetAction[]
}

/** Выбор одного действия снизу экрана: крупные строки в зоне большого пальца и «Отменить» последней. */
export function ActionSheet({ open, onClose, title, actions }: ActionSheetProps) {
  const titleId = useId()
  return (
    <ModalLayer
      open={open}
      onDismiss={onClose}
      labelledBy={title ? titleId : undefined}
      label={title ? undefined : 'Действия'}
      placement="bottom"
      panelClassName={styles.sheet}
    >
      <div className={styles.group}>
        {title && (
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
        )}
        <ul className={styles.list}>
          {actions.map((a) => (
            <li key={a.key}>
              <button
                type="button"
                className={cx(styles.action, a.tone === 'danger' && styles.danger)}
                onClick={() => {
                  a.onSelect()
                  onClose()
                }}
              >
                {a.icon && (
                  <span className={cx(styles.icon, a.tone && tones[a.tone])} aria-hidden="true">
                    {a.icon}
                  </span>
                )}
                <span className={styles.label}>{a.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Button variant="secondary" block onClick={onClose} className={styles.cancel}>
        Отменить
      </Button>
    </ModalLayer>
  )
}
