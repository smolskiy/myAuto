import {
  IconDots,
  IconGasStation,
  IconGauge,
  IconHome,
  IconList,
  IconNote,
  IconReceipt,
  IconSearch,
  IconTool,
} from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import {
  ActionSheet,
  AppBar,
  BottomSheet,
  BottomTabBar,
  Button,
  Dialog,
  IconButton,
  MoneyField,
  SyncStatusBadge,
  TextField,
  useToast,
  VehicleSwitcher,
  type TabItem,
} from '../../index'
import { Caption, Demo, Row, Section, Stack } from '../kit'

export const RECORD_KINDS = [
  { key: 'service', label: 'ТО и ремонт', icon: <IconTool />, tone: 'service' as const },
  { key: 'fuel', label: 'Заправка', icon: <IconGasStation />, tone: 'fuel' as const },
  { key: 'expense', label: 'Расход', icon: <IconReceipt />, tone: 'expense' as const },
  { key: 'odometer', label: 'Пробег', icon: <IconGauge />, tone: 'odometer' as const },
  { key: 'note', label: 'Заметка', icon: <IconNote />, tone: 'note' as const },
]

export function tabs(active: string): [TabItem, TabItem, TabItem, TabItem] {
  const t = (key: string, label: string, icon: ReactNode): TabItem => ({
    key,
    label,
    icon,
    href: '#/showcase',
    active: key === active,
  })
  return [
    t('home', 'Главная', <IconHome />),
    t('journal', 'Журнал', <IconList />),
    t('reminders', 'ТО', <IconTool />),
    t('more', 'Ещё', <IconDots />),
  ]
}

export function OverlaysSection() {
  const toast = useToast()
  const [sheet, setSheet] = useState(false)
  const [actions, setActions] = useState(false)
  const [dialog, setDialog] = useState(false)
  const [switcher, setSwitcher] = useState(false)
  const [vehicle, setVehicle] = useState('a')
  const [amount, setAmount] = useState<number | undefined>(undefined)
  const [active, setActive] = useState('home')

  return (
    <Section title="Навигация и оверлеи" lead="Шапка, нижняя панель с «+», шторки, диалог, уведомление.">
      <Demo name="AppBar" plain>
        <div
          style={{
            borderRadius: 'var(--radius-lg)',
            border: 'var(--border-width) solid var(--color-border)',
            overflow: 'hidden',
          }}
        >
          <AppBar
            title="Замена масла и фильтров"
            onBack={() => {}}
            actions={<IconButton label="Ещё" icon={<IconDots />} />}
          />
        </div>
        <div
          style={{
            borderRadius: 'var(--radius-lg)',
            border: 'var(--border-width) solid var(--color-border)',
            overflow: 'hidden',
          }}
        >
          <AppBar
            title="Журнал"
            large
            actions={
              <>
                <IconButton label="Поиск" icon={<IconSearch />} />
                <SyncStatusBadge state="idle" lastSyncText="сегодня в 14:20" />
              </>
            }
          />
        </div>
      </Demo>

      <Demo
        name="BottomTabBar"
        note="Две вкладки, «+» по центру, две вкладки; учитывает нижнюю безопасную зону."
        plain
      >
        <div style={{ paddingTop: 'var(--space-3)' }}>
          <BottomTabBar
            items={tabs(active)}
            onAdd={() => setActions(true)}
            renderLink={(item, children) => (
              <a
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  setActive(item.key)
                }}
              >
                {children}
              </a>
            )}
          />
        </div>
      </Demo>

      <Demo
        name="SyncStatusBadge"
        note="Форма значка и имя говорят о состоянии; число — неотправленные изменения."
      >
        <Row>
          <SyncStatusBadge state="idle" lastSyncText="сегодня в 14:20" />
          <SyncStatusBadge state="syncing" pending={3} />
          <SyncStatusBadge state="error" pending={12} />
          <SyncStatusBadge state="offline" />
          <SyncStatusBadge state="off" />
        </Row>
      </Demo>

      <Demo name="Шторки, диалог, уведомление">
        <Stack gap={2}>
          <Button variant="secondary" block onClick={() => setActions(true)}>
            ActionSheet — выбор типа записи
          </Button>
          <Button variant="secondary" block onClick={() => setSheet(true)}>
            BottomSheet с полем ввода
          </Button>
          <Button variant="secondary" block onClick={() => setSwitcher(true)}>
            VehicleSwitcher
          </Button>
          <Button variant="danger" block onClick={() => setDialog(true)}>
            Dialog — удалить запись
          </Button>
          <Button
            variant="ghost"
            block
            onClick={() =>
              toast.show({
                text: 'Запись удалена',
                action: { label: 'Отменить', onClick: () => toast.show({ text: 'Запись восстановлена' }) },
              })
            }
          >
            Toast с «Отменить»
          </Button>
          <Caption>
            Шторка ограничена высотой экрана и поднимается над клавиатурой; поле в фокусе прокручивается в
            видимую часть.
          </Caption>
        </Stack>
      </Demo>

      <ActionSheet
        open={actions}
        onClose={() => setActions(false)}
        title="Новая запись"
        actions={RECORD_KINDS.map((k) => ({
          ...k,
          onSelect: () => toast.show({ text: `Выбрано: ${k.label}` }),
        }))}
      />

      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Быстрый расход"
        footer={
          <Button block onClick={() => setSheet(false)}>
            Сохранить
          </Button>
        }
      >
        <Stack gap={4}>
          <TextField label="Что купили" placeholder="Омывайка, щётки" />
          <MoneyField label="Сумма" value={amount} onChange={setAmount} quickAdd={[500, 1000]} />
          <TextField label="Где" placeholder="Магазин или СТО" />
          <TextField label="Заметка" placeholder="Необязательно" />
        </Stack>
      </BottomSheet>

      <VehicleSwitcher
        open={switcher}
        onClose={() => setSwitcher(false)}
        activeId={vehicle}
        vehicles={[
          { id: 'a', name: 'Октавия', subtitle: 'Skoda Octavia 1.4 TSI, 2019 · А123ВС 77' },
          { id: 'b', name: 'Нива', subtitle: 'Lada Niva Travel, 2021' },
        ]}
        onSelect={setVehicle}
        onAdd={() => {}}
        onGarage={() => {}}
      />

      <Dialog
        open={dialog}
        title="Удалить запись?"
        text="Заправка 9 сентября. Её можно будет вернуть в течение 5 секунд."
        confirmLabel="Удалить"
        danger
        onConfirm={() => {
          setDialog(false)
          toast.show({ text: 'Запись удалена', action: { label: 'Отменить', onClick: () => {} } })
        }}
        onCancel={() => setDialog(false)}
      />
    </Section>
  )
}
