import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../lib/cx'
import styles from './Overlay.module.css'

/**
 * Куда рисовать слои. По умолчанию — в document.body; витрина подставляет колонку своей темы,
 * чтобы шторка из тёмной колонки была тёмной.
 */
const PortalTargetContext = createContext<HTMLElement | null>(null)
export const PortalTargetProvider = PortalTargetContext.Provider

/** Длительность выхода — как --dur-base. */
const EXIT_MS = 200

/** Держит слой в DOM на время анимации закрытия. */
function usePresence(open: boolean): boolean {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  useEffect(() => {
    if (open || !mounted) return
    const t = setTimeout(() => setMounted(false), EXIT_MS)
    return () => clearTimeout(t)
  }, [open, mounted])
  return mounted
}

// Стек открытых слоёв: Escape и ловушку фокуса обрабатывает только верхний.
const stack: string[] = []
let scrollLocks = 0

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest('[inert]'))
}

export interface ModalLayerProps {
  open: boolean
  onDismiss(): void
  role?: 'dialog' | 'alertdialog'
  labelledBy?: string
  label?: string
  describedBy?: string
  /** Куда поставить фокус при открытии; по умолчанию — на саму панель. */
  initialFocus?: RefObject<HTMLElement | null>
  placement: 'bottom' | 'center'
  panelClassName?: string
  panelRef?: RefObject<HTMLDivElement | null>
  children: ReactNode
}

/** Модальный слой: портал, затемнение, ловушка фокуса, Escape, блок прокрутки, возврат фокуса. */
export function ModalLayer({
  open,
  onDismiss,
  role = 'dialog',
  labelledBy,
  label,
  describedBy,
  initialFocus,
  placement,
  panelClassName,
  panelRef,
  children,
}: ModalLayerProps) {
  const mounted = usePresence(open)
  const target = useContext(PortalTargetContext)
  const ownRef = useRef<HTMLDivElement>(null)
  const ref = panelRef ?? ownRef
  const id = useId()
  const dismissRef = useRef(onDismiss)
  useEffect(() => {
    dismissRef.current = onDismiss
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    stack.push(id)
    if (scrollLocks++ === 0) document.body.style.overflow = 'hidden'
    ;(initialFocus?.current ?? ref.current)?.focus({ preventScroll: true })

    const onKeyDown = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id || !ref.current) return
      if (e.key === 'Escape') {
        e.preventDefault()
        dismissRef.current()
      } else if (e.key === 'Tab') {
        const list = focusables(ref.current)
        if (list.length === 0) {
          e.preventDefault()
          ref.current.focus()
          return
        }
        const first = list[0]!
        const last = list[list.length - 1]!
        const active = document.activeElement
        if (e.shiftKey && (active === first || active === ref.current)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        } else if (!ref.current.contains(active)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      stack.splice(stack.indexOf(id), 1)
      if (--scrollLocks === 0) document.body.style.overflow = ''
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true })
    }
  }, [open, id, initialFocus, ref])

  if (!mounted) return null
  const state = open ? 'open' : 'closed'
  return createPortal(
    <div className={cx(styles.layer, styles[placement])} data-state={state}>
      <div className={styles.backdrop} data-state={state} onClick={() => open && onDismiss()} aria-hidden="true" />
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        aria-describedby={describedBy}
        tabIndex={-1}
        data-state={state}
        className={cx(styles.panel, panelClassName)}
      >
        {children}
      </div>
    </div>,
    target ?? document.body,
  )
}
