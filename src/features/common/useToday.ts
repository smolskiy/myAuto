import { useEffect, useState } from 'react'
import { todayISO } from '../../domain/dates'
import type { ISODate } from '../../domain/types'

const MINUTE = 60_000

/**
 * Сегодняшняя дата, которая сама меняется: при возврате в приложение (PWA на телефоне месяцами живёт
 * в фоне) и раз в минуту — чтобы полночь не прошла мимо открытого экрана.
 */
export function useToday(): ISODate {
  const [today, setToday] = useState(() => todayISO())
  useEffect(() => {
    const refresh = () => setToday(todayISO())
    const onVisibility = () => {
      if (document.visibilityState !== 'hidden') refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const timer = setInterval(refresh, MINUTE)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(timer)
    }
  }, [])
  return today
}
