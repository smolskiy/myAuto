import type { ReactNode } from 'react'
import { AppBar } from '../../ui'
import styles from './Page.module.css'
import { useGoBack } from './useGoBack'

export interface PageProps {
  /** Заголовок экрана — единственный h1. */
  title: string
  /**
   * Кнопка «Назад»: шаг по истории. Истории в приложении нет (открыли по ссылке) — на запасной путь заменой:
   * `true` — на главную, строка — на этот путь (`back="/garage"` у карточки машины).
   */
  back?: boolean | string
  /** Кнопки справа в шапке (IconButton, SyncStatusBadge). */
  actions?: ReactNode
  /** Крупный заголовок — для корневых разделов (Главная, Журнал, ТО, Ещё). */
  large?: boolean
  children?: ReactNode
}

/** Каркас экрана: липкая шапка и колонка содержимого с отступами и безопасными зонами по бокам. */
export function Page({ title, back, actions, large, children }: PageProps) {
  const goBack = useGoBack()
  const onBack = back ? () => goBack(typeof back === 'string' ? back : '/') : undefined
  return (
    <>
      <AppBar title={title} onBack={onBack} actions={actions} large={large} />
      <div className={styles.body}>{children}</div>
    </>
  )
}
