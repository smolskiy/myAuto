import { IconX } from '@tabler/icons-react'
import { useEffect, useId, useRef, type PointerEvent, type ReactNode } from 'react'
import { IconButton } from '../IconButton/IconButton'
import { ModalLayer } from '../Overlay/Overlay'
import styles from './BottomSheet.module.css'

export interface BottomSheetProps {
  open: boolean
  onClose(): void
  title?: string
  children: ReactNode
  /** Закреплённый низ (кнопка «Сохранить»). */
  footer?: ReactNode
}

/** Порог стягивания вниз за «ручку», px. */
const DRAG_CLOSE = 80
/** Сколько ждать выезда экранной клавиатуры перед прокруткой к полю, мс. */
const KEYBOARD_DELAY = 300

/**
 * Шторка снизу. Не выше экрана за вычетом безопасной зоны, содержимое прокручивается.
 * Экранная клавиатура: шторка поднимается над ней (visualViewport), поле в фокусе прокручивается в видимую часть.
 */
export function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; dy: number } | null>(null)

  // Поле в фокусе — в видимую часть, когда клавиатура уже выехала.
  useEffect(() => {
    const panel = panelRef.current
    if (!open || !panel) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement
      if (!el.matches('input, textarea, select')) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        el.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
      }, KEYBOARD_DELAY)
    }
    panel.addEventListener('focusin', onFocusIn)
    return () => {
      clearTimeout(timer)
      panel.removeEventListener('focusin', onFocusIn)
    }
  }, [open])

  // Шторка над экранной клавиатурой: высота видимой области из visualViewport.
  useEffect(() => {
    const panel = panelRef.current
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!open || !panel || !vv) return
    const update = () => {
      const keyboard = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      panel.style.setProperty('--keyboard-inset', `${keyboard}px`)
      panel.style.setProperty('--viewport-height', `${vv.height}px`)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [open])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { y: e.clientY, dy: 0 }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !panelRef.current) return
    drag.current.dy = Math.max(0, e.clientY - drag.current.y)
    panelRef.current.style.transform = `translateY(${drag.current.dy}px)`
    panelRef.current.style.transition = 'none'
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!panelRef.current) return
    panelRef.current.style.transform = ''
    panelRef.current.style.transition = ''
    if (d && d.dy > DRAG_CLOSE) onClose()
  }

  return (
    <ModalLayer
      open={open}
      onDismiss={onClose}
      labelledBy={title ? titleId : undefined}
      label={title ? undefined : 'Панель'}
      placement="bottom"
      panelClassName={styles.sheet}
      panelRef={panelRef}
    >
      <div
        className={styles.grip}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          {title ? (
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
          ) : (
            <span />
          )}
          <IconButton label="Закрыть" icon={<IconX />} variant="filled" size="sm" onClick={onClose} />
        </div>
      </div>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </ModalLayer>
  )
}
