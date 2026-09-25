import { IconAlertTriangle, IconHome, IconRefresh } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router'
import { Button, Spinner } from '../ui'
import styles from './ErrorPage.module.css'
import { reloadPage } from './reload'

/** Chrome, Safari и Firefox по-разному говорят «чанк старой версии не найден». */
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i

/**
 * Текст ошибки чанка, из-за которой уже перезагружались. Та же ошибка после перезагрузки — показываем страницу
 * (перезагрузка не помогла, цикла нет); другая (не нашёлся другой файл, следующий выпуск) — перезагружаем снова.
 */
const AUTO_RELOAD_KEY = 'myauto.chunkReloadError'

function errorText(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`.trim()
  if (error instanceof Error) return error.message
  return String(error)
}

function canAutoReload(error: unknown): boolean {
  const text = errorText(error)
  if (!CHUNK_ERROR.test(text)) return false
  try {
    return sessionStorage.getItem(AUTO_RELOAD_KEY) !== text
  } catch {
    return false // хранилище недоступно — не запомнить, что уже перезагружались: автоматически не перезагружаем
  }
}

/**
 * Страница ошибки корневого маршрута: вместо английской страницы React Router. Ошибка загрузки чанка после
 * выхода новой версии — одна автоматическая перезагрузка (старые файлы уже удалены с сервера).
 */
export default function ErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()
  const [autoReload] = useState(() => canAutoReload(error))

  useEffect(() => {
    if (!autoReload) return
    try {
      sessionStorage.setItem(AUTO_RELOAD_KEY, errorText(error))
    } catch {
      // canAutoReload уже проверил хранилище
    }
    reloadPage()
  }, [autoReload, error])

  useEffect(() => {
    if (!autoReload) console.error(error)
  }, [autoReload, error])

  if (autoReload) {
    return (
      <main className={styles.page}>
        <Spinner size={24} label="Загружаем новую версию" />
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <span className={styles.icon} aria-hidden="true">
        <IconAlertTriangle size={28} stroke={1.75} />
      </span>
      <h1 className={styles.title}>Что-то пошло не так</h1>
      <p className={styles.text}>Данные на устройстве не пострадали. Перезагрузите приложение.</p>
      <p className={styles.details}>{errorText(error)}</p>
      <div className={styles.actions}>
        <Button block icon={<IconRefresh />} onClick={reloadPage}>
          Перезагрузить
        </Button>
        <Button block variant="secondary" icon={<IconHome />} onClick={() => navigate('/')}>
          На главную
        </Button>
      </div>
    </main>
  )
}
