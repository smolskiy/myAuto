import { IconCloud, IconDatabase } from '@tabler/icons-react'
import { useNavigate } from 'react-router'
import { version } from '../../../package.json'
import { useSyncStatus } from '../../sync/react'
import { Icon, ListGroup, ListItem, SegmentedControl, useTheme, type ThemePreference } from '../../ui'
import { Page } from '../common'
import styles from './Settings.module.css'
import { syncStateText } from './syncText'
import { useNow } from './useNow'

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Как в системе' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
]

/** Настройки: тема, ссылки на синхронизацию и выгрузки, версия приложения. */
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
        <ListItem title="Версия" value={version} />
      </ListGroup>
    </Page>
  )
}
