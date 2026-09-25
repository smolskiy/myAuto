import { IconArrowDown } from '@tabler/icons-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { Spinner } from '../Spinner/Spinner'
import styles from './PullToRefresh.module.css'

export interface PullToRefreshProps {
  onRefresh(): Promise<void>
  children: ReactNode
  disabled?: boolean
}

/** Сколько нужно протянуть (после сопротивления), чтобы отпускание обновило. */
const THRESHOLD = 64
const RESISTANCE = 0.5
const MAX_PULL = 120

function atTop(): boolean {
  return (document.scrollingElement?.scrollTop ?? window.scrollY) <= 0
}

/**
 * «Потянуть, чтобы обновить» для пальца (Touch Events: они не прерываются прокруткой, в отличие от Pointer Events).
 * Работает только когда страница прокручена к самому верху.
 */
export function PullToRefresh({ onRefresh, children, disabled }: PullToRefreshProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const start = useRef<number | null>(null)
  const pullRef = useRef(0)
  const refreshRef = useRef(onRefresh)
  useEffect(() => {
    refreshRef.current = onRefresh
  })

  useEffect(() => {
    const el = ref.current
    if (!el || disabled || refreshing) return
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      start.current = t && atTop() ? t.clientY : null
    }
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0]
      if (start.current === null || !t) return
      const dy = t.clientY - start.current
      if (dy <= 0) {
        pullRef.current = 0
        setPull(0)
        return
      }
      if (e.cancelable) e.preventDefault()
      const next = Math.min(MAX_PULL, dy * RESISTANCE)
      pullRef.current = next
      setPull(next)
    }
    const onEnd = () => {
      const reached = start.current !== null && pullRef.current >= THRESHOLD
      start.current = null
      pullRef.current = 0
      setPull(0)
      if (!reached) return
      setRefreshing(true)
      refreshRef
        .current()
        .catch(() => {})
        .finally(() => setRefreshing(false))
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [disabled, refreshing])

  const offset = refreshing ? THRESHOLD : pull
  const ready = pull >= THRESHOLD
  return (
    <div ref={ref} className={styles.area} data-pull="">
      <div
        className={cx(styles.indicator, (pull > 0 || refreshing) && styles.visible)}
        style={{ transform: `translate(-50%, ${offset - 44}px)` }}
        aria-hidden={!refreshing}
      >
        {refreshing ? (
          <Spinner size={24} label="Обновление" />
        ) : (
          <IconArrowDown
            className={cx(styles.arrow, ready && styles.ready)}
            size={22}
            stroke={2}
            aria-hidden="true"
          />
        )}
      </div>
      <div
        className={cx(styles.content, pull === 0 && styles.settled)}
        style={offset ? { transform: `translateY(${offset}px)` } : undefined}
      >
        {children}
      </div>
    </div>
  )
}
