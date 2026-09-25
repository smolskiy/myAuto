import { createContext, useContext, useLayoutEffect } from 'react'

/**
 * Высота нижней полосы FormPage с кнопкой «Сохранить» (кнопка 48 px + отступы + рамка) — уведомления
 * встают над ней. Те же числа — в FormPage.module.css.
 */
export const FORM_FOOTER_OFFSET = 'calc(48px + 2 * var(--space-3) + var(--border-width))'

/** Регистрирует открытую форму; возвращает отмену регистрации. */
export type RegisterForm = () => () => void

/**
 * «Режим формы» для оболочки: пока на экране FormPage, оболочка прячет нижнюю панель на любом маршруте
 * и ставит уведомления над кнопкой «Сохранить». Без оболочки (тесты, витрина) — ничего не делает.
 */
export const FormModeContext = createContext<RegisterForm | null>(null)

/** Вызывает FormPage: регистрация в layout-эффекте — панель скрывается до первой отрисовки кадра. */
export function useFormMode(): void {
  const register = useContext(FormModeContext)
  useLayoutEffect(() => register?.(), [register])
}
