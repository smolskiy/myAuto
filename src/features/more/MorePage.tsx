import {
  IconBox,
  IconBuildingWarehouse,
  IconChartBar,
  IconCloud,
  IconDatabase,
  IconFileText,
  IconMapPin,
  IconSettings,
  IconWheel,
  type TablerIcon,
} from '@tabler/icons-react'
import { useNavigate } from 'react-router'
import { useYandexConnected } from '../../sync/react'
import { Icon, ListGroup, ListItem } from '../../ui'
import { Page } from '../common'

interface Entry {
  label: string
  path: string
  icon: TablerIcon
}

const GROUPS: { title: string; entries: Entry[] }[] = [
  {
    title: 'Машина',
    entries: [
      { label: 'Статистика', path: '/stats', icon: IconChartBar },
      { label: 'Гараж', path: '/garage', icon: IconBuildingWarehouse },
      { label: 'Документы', path: '/documents', icon: IconFileText },
      { label: 'Шины', path: '/tires', icon: IconWheel },
    ],
  },
  {
    title: 'Справочники',
    entries: [
      { label: 'Места и мастера', path: '/places', icon: IconMapPin },
      { label: 'Узлы и расходники', path: '/catalog', icon: IconBox },
    ],
  },
  {
    title: 'Приложение',
    entries: [
      { label: 'Настройки', path: '/settings', icon: IconSettings },
      { label: 'Синхронизация', path: '/settings/sync', icon: IconCloud },
      { label: 'Данные и выгрузки', path: '/settings/data', icon: IconDatabase },
    ],
  },
]

/** Меню «Ещё»: разделы машины, справочники и настройки приложения. */
export default function MorePage() {
  const navigate = useNavigate()
  const connected = useYandexConnected()
  return (
    <Page title="Ещё" large>
      {GROUPS.map((group) => (
        <ListGroup key={group.title} title={group.title}>
          {group.entries.map((e) => (
            <ListItem
              key={e.path}
              title={e.label}
              leading={<Icon icon={e.icon} tone="accent" circle />}
              value={e.path === '/settings/sync' ? (connected ? 'Вкл.' : 'Выкл.') : undefined}
              chevron
              onClick={() => void navigate(e.path)}
            />
          ))}
        </ListGroup>
      ))}
    </Page>
  )
}
