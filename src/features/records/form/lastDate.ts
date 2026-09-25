import type { ISODate } from '../../../domain/types'

/**
 * Дата последней сохранённой записи на время сессии: при вводе старой истории с бумаги следующая
 * запись обычно того же дня, а не сегодняшняя.
 */
const KEY = 'myauto.lastDate'

export function rememberDate(d: ISODate): void {
  try {
    sessionStorage.setItem(KEY, d)
  } catch {
    // Хранилище недоступно (приватный режим) — подсказки просто не будет.
  }
}

/** Дата прошлой записи сессии, если она не сегодняшняя; иначе null. */
export function suggestedDate(today: ISODate): ISODate | null {
  try {
    const d = sessionStorage.getItem(KEY)
    return d && d !== today ? d : null
  } catch {
    return null
  }
}
