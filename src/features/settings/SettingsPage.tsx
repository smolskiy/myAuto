import { IconCloud, IconCloudDownload, IconDatabase, IconRefresh } from '@tabler/icons-react'
import { useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router'
import { version } from '../../../package.json'
import { appUpdate, type CheckResult } from '../../app/appUpdate'
import { useSyncStatus } from '../../sync/react'
import {
  Icon,
  ListGroup,
  ListItem,
  SegmentedControl,
  useTheme,
  useToast,
  type ThemePreference,
} from '../../ui'
import { DirectoryCityField, Page } from '../common'
import styles from './Settings.module.css'
import { syncStateText } from './syncText'
import { useNow } from './useNow'

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Как в системе' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

/** «26 сентября, 14:05» — когда собрана стоящая версия. */
const BUILD_TEXT = `Сборка ${new Date(__BUILD_TIME__).toLocaleString('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})}`

const CHECK_TEXT: Record<Exclude<CheckResult, 'ready'>, string> = {
  latest: 'Установлена последняя версия',
  downloading: 'Скачиваем новую версию — предложим обновить',
  offline: 'Нет сети — проверим позже',
}

/** Новая версия скачана — «Обновить приложение», иначе «Проверить обновления». */
function UpdateItem() {
  const toast = useToast()
  const ready = useSyncExternalStore(appUpdate.subscribe, appUpdate.isReady)
  if (ready)
    return (
      <ListItem
        title="Обновить приложение"
        subtitle="Новая версия скачана"
        leading={<Icon icon={IconRefresh} tone="accent" circle />}
        onClick={() => void appUpdate.apply()}
      />
    )
  return (
    <ListItem
      title="Проверить обновления"
      leading={<Icon icon={IconCloudDownload} tone="accent" circle />}
      onClick={() =>
        void appUpdate.check().then((result) => {
          if (result !== 'ready') toast.show({ text: CHECK_TEXT[result] })
        })
      }
    />
  )
}

/** Настройки: тема, город справочника СТО и АЗС, ссылки на синхронизацию и выгрузки, версия приложения и обновление. */
export default function SettingsPage() {
  const navigate = useNavigate()
  const { preference, setPreference } = useTheme()
  const status = useSyncStatus()
  const now = useNow()
  return (
    <Page title="Настройки" back="/more">
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Тема</h2>
        <div className={styles.segments}>
          <SegmentedControl ariaLabel="Тема" value={preference} options={THEMES} onChange={setPreference} />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Справочник СТО и АЗС</h2>
        <DirectoryCityField hint="Подсказываем автосервисы, шиномонтажи и заправки этого города при вводе места" />
      </section>

      <ListGroup title="Данные">
        <ListItem
          title="Синхронизация"
          subtitle={syncStateText(status, now)}
          leading={<Icon icon={IconCloud} tone="accent" circle />}
          chevron
          onClick={() => void navigate('/settings/sync')}
        />
        <ListItem
          title="Данные и выгрузки"
          subtitle="Копия JSON, Excel, загрузка копии"
          leading={<Icon icon={IconDatabase} tone="accent" circle />}
          chevron
          onClick={() => void navigate('/settings/data')}
        />
      </ListGroup>

      <ListGroup title="О приложении">
        <ListItem title="Версия" subtitle={BUILD_TEXT} value={version} />
        <UpdateItem />
      </ListGroup>
    </Page>
  )
}
