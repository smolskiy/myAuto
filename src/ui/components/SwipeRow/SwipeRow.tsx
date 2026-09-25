import { IconDotsVertical } from '@tabler/icons-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cx } from '../../lib/cx'
import { usePortalTarget } from '../Overlay/Overlay'
import styles from './SwipeRow.module.css'

export interface SwipeAction {
  label: string
  icon: ReactNode
  tone: 'danger' | 'accent'
  onAction(): void
}

export interface SwipeRowProps {
  children: ReactNode
  /** Свайп вправо открывает левое действие («Повторить»). */
  left?: SwipeAction
  /** Свайп влево открывает правое действие («Удалить»). */
  right?: SwipeAction
}

/** Доля ширины строки, после которой отпускание выполняет действие. */
const THRESHOLD = 0.3
/** Сдвиг, после которого решаем: свайп или прокрутка. */
const SLOP = 8

type Gesture = { id: number; x: number; y: number; axis: 'x' | 'y' | null; width: number; dx: number }
/** Меню рисуется в портале с position: fixed — его не обрезает скруглённая карточка списка. */
type MenuPos = { top?: number; bottom?: number; right: number }
const MENU_HEIGHT = 110

/**
 * Строка со свайпом пальцем или мышью (Pointer Events). Вертикальное движение отдаётся прокрутке.
 * Для клавиатуры и скринридера те же действия есть в меню «Действия».
 */
export function SwipeRow({ children, left, right }: SwipeRowProps) {
  const [dx, setDx] = useState(0)
  const [width, setWidth] = useState(0)
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null)
  const menuOpen = menuPos !== null
  const portalTarget = usePortalTarget()
  const gesture = useRef<Gesture | null>(null)
  const swiped = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const menuId = useId()
  const actions = [left, right].filter((a): a is SwipeAction => !!a)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    gesture.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      axis: null,
      width: e.currentTarget.offsetWidth || 1,
      dx: 0,
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    const mx = e.clientX - g.x
    const my = e.clientY - g.y
    if (!g.axis) {
      if (Math.abs(mx) < SLOP && Math.abs(my) < SLOP) return
      g.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
      if (g.axis === 'y') {
        gesture.current = null
        return
      }
      e.currentTarget.setPointerCapture?.(e.pointerId)
      setWidth(g.width)
    }
    // Тянуть можно только в сторону, где есть действие; за порогом — с сопротивлением.
    let next = mx
    if ((next > 0 && !left) || (next < 0 && !right)) next = 0
    const limit = g.width * THRESHOLD * 1.6
    if (Math.abs(next) > limit) next = Math.sign(next) * (limit + (Math.abs(next) - limit) * 0.3)
    g.dx = next
    setDx(next)
  }

  const finish = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gesture.current
    gesture.current = null
    if (!g || g.id !== e.pointerId || g.axis !== 'x') return
    swiped.current = true
    setDx(0)
    if (cancelled) return
    if (g.dx <= -g.width * THRESHOLD) right?.onAction()
    else if (g.dx >= g.width * THRESHOLD) left?.onAction()
  }

  // Клик после свайпа — не клик по строке.
  const onClickCapture = (e: MouseEvent) => {
    if (swiped.current) {
      swiped.current = false
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const openMenu = () => {
    const r = buttonRef.current?.getBoundingClientRect()
    if (!r) return
    const right = Math.max(8, window.innerWidth - r.right)
    const below = window.innerHeight - r.bottom
    setMenuPos(
      below > MENU_HEIGHT || below > r.top
        ? { top: r.bottom + 4, right }
        : { bottom: window.innerHeight - r.top + 4, right },
    )
  }
  const closeMenu = () => setMenuPos(null)

  // Меню: фокус на первый пункт; закрыть по нажатию вне, прокрутке и смене размера окна.
  useEffect(() => {
    if (!menuOpen) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onDown = (ev: globalThis.PointerEvent) => {
      const t = ev.target as Node
      if (!rootRef.current?.contains(t) && !menuRef.current?.contains(t)) setMenuPos(null)
    }
    const onMove = () => setMenuPos(null)
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [menuOpen])

  const onMenuKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closeMenu()
      buttonRef.current?.focus()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      items[(i + step + items.length) % items.length]?.focus()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      closeMenu()
      buttonRef.current?.focus()
    }
  }

  const reveal = dx > 0 ? left : dx < 0 ? right : undefined
  const armed = !!reveal && width > 0 && Math.abs(dx) >= width * THRESHOLD

  return (
    <div ref={rootRef} className={styles.swipe} data-swiping={dx !== 0 || undefined}>
      {reveal && (
        <div
          className={cx(styles.under, dx > 0 ? styles.underLeft : styles.underRight, styles[reveal.tone])}
          aria-hidden="true"
        >
          <span className={cx(styles.underAction, armed && styles.armed)}>
            {reveal.icon}
            <span>{reveal.label}</span>
          </span>
        </div>
      )}
      <div
        className={cx(styles.content, dx === 0 && styles.settled)}
        style={dx ? { transform: `translateX(${dx}px)` } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, false)}
        onPointerCancel={(e) => finish(e, true)}
        onClickCapture={onClickCapture}
      >
        {children}
      </div>
      {actions.length > 0 && (
        <div className={styles.menuWrap}>
          <button
            ref={buttonRef}
            type="button"
            className={styles.more}
            aria-label="Действия"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => (menuOpen ? closeMenu() : openMenu())}
          >
            <IconDotsVertical size={20} stroke={2} aria-hidden="true" />
          </button>
          {menuPos &&
            createPortal(
              <ul
                id={menuId}
                ref={menuRef}
                role="menu"
                aria-label="Действия"
                className={styles.menu}
                style={{ position: 'fixed', ...menuPos }}
                onKeyDown={onMenuKeyDown}
              >
                {actions.map((a) => (
                  <li key={a.label} role="none">
                    <button
                      type="button"
                      role="menuitem"
                      tabIndex={-1}
                      className={cx(styles.menuItem, styles[a.tone])}
                      onClick={() => {
                        closeMenu()
                        buttonRef.current?.focus()
                        a.onAction()
                      }}
                    >
                      <span className={styles.menuIcon} aria-hidden="true">
                        {a.icon}
                      </span>
                      {a.label}
                    </button>
                  </li>
                ))}
              </ul>,
              portalTarget ?? document.body,
            )}
        </div>
      )}
    </div>
  )
}
