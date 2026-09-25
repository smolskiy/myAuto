import { IconAlertTriangle, IconHome, IconRefresh } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router'
import { Button, Spinner } from '../ui'
import styles from './ErrorPage.module.css'
import { reloadPage } from './reload'

/** Chrome, Safari и Firefox по-разному говорят «чанк старой версии не найден». */
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i

/** Когда была автоматическая перезагрузка: вторая подряд (в пределах окна) не делается — так нет цикла. */
const AUTO_RELOAD_KEY = 'myauto.chunkReloadAt'
const AUTO_RELOAD_WINDOW_MS = 10_000

function errorText(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`.trim()
  if (error instanceof Error) return error.message
  return String(error)
}

function lastAutoReload(): number | null {
  try {
    return Number(sessionStorage.getItem(AUTO_RELOAD_KEY) ?? 0)
  } catch {
    return null // хранилище недоступно — автоматически не перезагружаем вовсе
  }
}

function canAutoReload(error: unknown): boolean {
  if (!CHUNK_ERROR.test(errorText(error))) return false
  const last = lastAutoReload()
  return last !== null && Date.now() - last > AUTO_RELOAD_WINDOW_MS
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
      sessionStorage.setItem(AUTO_RELOAD_KEY, String(Date.now()))
    } catch {
      // canAutoReload уже проверил хранилище
    }
    reloadPage()
  }, [autoReload])

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
