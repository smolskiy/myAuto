import {
  IconAlertTriangle,
  IconCloudCheck,
  IconCloudOff,
  IconFileText,
  IconFolder,
  IconLogout,
  IconRefresh,
  IconWifiOff,
  type TablerIcon,
} from '@tabler/icons-react'
import { useId, useState } from 'react'
import { useNavigate } from 'react-router'
import type { SyncState } from '../../sync/contracts'
import { syncEngine, yandexAuth } from '../../sync/index'
import { useLoginError, useSyncStatus, useYandexConnected } from '../../sync/react'
import { Button, Dialog, Icon, ListGroup, ListItem, TextField, useToast, type Tone } from '../../ui'
import { Page } from '../common'
import { goToUrl } from './leave'
import styles from './Settings.module.css'
import { syncStateText } from './syncText'
import { useNow } from './useNow'
import { useVehiclesArrived } from './useVehiclesArrived'

const STATE_ICON: Record<SyncState, { icon: TablerIcon; tone: Tone }> = {
  off: { icon: IconCloudOff, tone: 'neutral' },
  idle: { icon: IconCloudCheck, tone: 'ok' },
  syncing: { icon: IconRefresh, tone: 'accent' },
  offline: { icon: IconWifiOff, tone: 'soon' },
  error: { icon: IconAlertTriangle, tone: 'overdue' },
}

const CLIENT_ID_HINT = 'oauth.yandex.ru → ваше приложение → ClientID'
const NEED_CLIENT_ID = 'Сначала укажите ClientID'

/** Вход в Яндекс: основной — переходом на страницу Яндекса, запасной — по коду подтверждения. */
function LoginBlock() {
  const toast = useToast()
  const reasonId = useId()
  // ClientID из сборки — поле не нужно; пусто — владелец вводит свой (хранится на устройстве).
  const buildClientId = (import.meta.env.VITE_YANDEX_CLIENT_ID ?? '').trim()
  const [clientId, setClientId] = useState(() => yandexAuth.getClientId() ?? '')
  const [codeOpen, setCodeOpen] = useState(false)
  const [code, setCode] = useState('')
  const [connecting, setConnecting] = useState(false)
  const canLogin = !!buildClientId || !!clientId.trim()

  /** Ручной ClientID — сохраняем перед входом (loginUrl и verificationCodeUrl читают его). */
  const applyClientId = () => {
    if (!buildClientId) yandexAuth.setClientId(clientId.trim())
  }

  const loginWithYandex = () => {
    applyClientId()
    try {
      // loginUrl() пишет новый state — только здесь, в обработчике нажатия, прямо перед уходом.
      goToUrl(yandexAuth.loginUrl())
    } catch (e) {
      toast.show({ text: (e instanceof Error && e.message) || 'Не удалось начать вход' })
    }
  }

  const openCodePage = () => {
    applyClientId()
    try {
      window.open(yandexAuth.verificationCodeUrl(), '_blank', 'noopener')
      setCodeOpen(true)
    } catch (e) {
      toast.show({ text: (e instanceof Error && e.message) || 'Не удалось открыть страницу Яндекса' })
    }
  }

  const connect = async () => {
    setConnecting(true)
    try {
      await yandexAuth.connectWithCode(code)
      toast.show({ text: 'Яндекс.Диск подключён' })
    } catch {
      // Текст неудачи показывает useLoginError над блоком входа; неподошедший токен в поле не держим.
      setCode('')
    } finally {
      setConnecting(false)
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Вход в Яндекс</h2>
      <div className={styles.stack}>
        {!buildClientId && (
          <TextField
            label="ClientID"
            hint={CLIENT_ID_HINT}
            value={clientId}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setClientId(e.target.value)}
          />
        )}
        <Button
          block
          disabled={!canLogin}
          aria-describedby={canLogin ? undefined : reasonId}
          onClick={loginWithYandex}
        >
          Войти через Яндекс
        </Button>
        <Button
          block
          variant="secondary"
          disabled={!canLogin}
          aria-describedby={canLogin ? undefined : reasonId}
          onClick={openCodePage}
        >
          Войти по коду
        </Button>
        {!canLogin && (
          <p id={reasonId} className={styles.reason}>
            {NEED_CLIENT_ID}
          </p>
        )}
        {codeOpen && (
          <>
            {/* «Код» — это токен доступа к Диску: скрыт, без подсказок клавиатуры и автоисправлений. */}
            <TextField
              label="Код со страницы Яндекса"
              hint="Скопируйте код на открывшейся странице и вставьте сюда"
              type="password"
              value={code}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button block loading={connecting} onClick={() => void connect()}>
              Подключить
            </Button>
          </>
        )}
      </div>
    </section>
  )
}

/** Синхронизация с Яндекс.Диском: состояние, вход и выход. Токен на экран не выводится. */
export default function SyncSettingsPage() {
  const navigate = useNavigate()
  const status = useSyncStatus()
  const connected = useYandexConnected()
  const loginError = useLoginError()
  const now = useNow()
  // Новое устройство: синхронизация принесла машины — дальше на главную, онбординг не нужен.
  const { arrived } = useVehiclesArrived()
  const [confirmLogout, setConfirmLogout] = useState(false)
  const { icon, tone } = STATE_ICON[status.state]
  const offNote = status.state === 'off' ? 'Данные только на этом устройстве' : undefined
  const pending = status.pendingUploads > 0 ? `Ждут загрузки: ${status.pendingUploads} фото` : undefined

  return (
    <Page title="Синхронизация" back="/settings">
      <ListGroup>
        <ListItem
          title={syncStateText(status, now)}
          subtitle={pending ?? offNote}
          leading={<Icon icon={icon} tone={tone} circle />}
        />
      </ListGroup>

      {arrived && (
        <Button block onClick={() => void navigate('/')}>
          Перейти на главную
        </Button>
      )}

      {loginError && (
        <p className={styles.error} role="alert">
          {loginError}
        </p>
      )}

      {connected ? (
        <ListGroup>
          <ListItem
            title="Синхронизировать сейчас"
            leading={<Icon icon={IconRefresh} tone="accent" circle />}
            onClick={() => void syncEngine.syncNow('manual')}
          />
          <ListItem
            title="Выйти"
            danger
            leading={<Icon icon={IconLogout} tone="overdue" circle />}
            onClick={() => setConfirmLogout(true)}
          />
        </ListGroup>
      ) : (
        <LoginBlock />
      )}

      <ListGroup title="Что хранится на Диске" footer="Другие программы и сайты эту папку не видят.">
        <ListItem
          title="Приложения/Мой авто/"
          subtitle="Папка приложения на вашем Яндекс.Диске"
          leading={<Icon icon={IconFolder} tone="accent" circle />}
        />
        <ListItem
          title="garage.json"
          subtitle="Все машины и записи, без файлов"
          leading={<Icon icon={IconFileText} circle />}
        />
        <ListItem
          title="attachments/"
          subtitle="Фото и PDF из записей и документов"
          leading={<Icon icon={IconFolder} circle />}
        />
        <ListItem
          title="backups/"
          subtitle="Копия за каждый день, последние 30"
          leading={<Icon icon={IconFolder} circle />}
        />
      </ListGroup>

      <Dialog
        open={confirmLogout}
        title="Выйти из Яндекса?"
        text="Данные останутся на этом устройстве, синхронизация остановится."
        confirmLabel="Выйти"
        danger
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false)
          void yandexAuth.disconnect()
        }}
      />
    </Page>
  )
}
