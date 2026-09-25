import { useEffect, useState } from 'react'

/** Текущее время, обновляемое раз в `intervalMs`, — чтобы «5 минут назад» не застывало на открытом экране. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
