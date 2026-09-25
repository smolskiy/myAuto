/**
 * Ошибка с текстом для владельца («Укажите пробег»): FormPage, useSoftDelete и поля показывают её `message`
 * уведомлением. Любая другая ошибка — сбой: владелец видит общий русский текст, подробности уходят в консоль.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserError'
  }
}

export const SAVE_FAILED = 'Не получилось сохранить — попробуйте ещё раз'
export const DELETE_FAILED = 'Не получилось удалить — попробуйте ещё раз'
export const RESTORE_FAILED = 'Не получилось вернуть — попробуйте ещё раз'
export const ADD_FILE_FAILED = 'Не получилось добавить файл — попробуйте ещё раз'

/** Текст для уведомления: у UserError — её текст, у сбоя — `fallback` (сам сбой — в console.error). */
export function userMessage(e: unknown, fallback: string): string {
  if (e instanceof UserError) return e.message
  console.error(e)
  return fallback
}
