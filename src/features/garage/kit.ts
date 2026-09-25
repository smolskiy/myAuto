/**
 * Мелочи, общие для справочных экранов (гараж, места, документы, шины, каталог).
 * Кандидаты в features/common — там их пока нет.
 */
import { UserError } from '../common'

/** Пустая строка поля — поле не заполнено. */
export function optional(value: string): string | undefined {
  const v = value.trim()
  return v ? v : undefined
}

/** Текст уведомления о сбое действия: у UserError — её текст, иначе общий (сам сбой — в консоль). */
export function failureText(e: unknown): string {
  if (e instanceof UserError) return e.message
  console.error(e)
  return 'Не получилось сохранить — попробуйте ещё раз'
}
