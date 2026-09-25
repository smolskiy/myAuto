import { IconDeviceFloppy, IconGasStation, IconGauge, IconReceipt, IconTool } from '@tabler/icons-react'
import { useState } from 'react'
import {
  AppBar,
  BottomTabBar,
  Button,
  Combobox,
  DateField,
  Icon,
  LineItemRow,
  ListGroup,
  MoneyField,
  OdometerField,
  RecordRow,
  ReminderCard,
  RepeatableList,
  SectionHeader,
  StatTile,
  SyncStatusBadge,
  TextField,
  VehicleCard,
  type ComboboxOption,
} from '../../index'
import { Demo, fmt, PhoneFrame, SAMPLE_CAR, Section } from '../kit'
import styles from '../Showcase.module.css'
import { tabs } from './OverlaysSection'

const QUICK = [
  { label: 'Заправка', icon: IconGasStation, tone: 'fuel' },
  { label: 'ТО', icon: IconTool, tone: 'service' },
  { label: 'Расход', icon: IconReceipt, tone: 'expense' },
  { label: 'Пробег', icon: IconGauge, tone: 'odometer' },
] as const

function HomeSketch() {
  return (
    <PhoneFrame label="Эскиз: главная">
      <AppBar
        title="Главная"
        large
        actions={<SyncStatusBadge state="idle" lastSyncText="сегодня в 14:20" />}
      />
      <div className={styles.phoneBody}>
        <VehicleCard
          name="Октавия"
          subtitle="Skoda Octavia 1.4 TSI, 2019"
          plate="А123ВС 77"
          odometer={fmt.km(148320)}
          photoUrl={SAMPLE_CAR}
          onSwitch={() => {}}
        />
        <div className={styles.quickActions}>
          {QUICK.map((q) => (
            <button key={q.label} type="button" className={styles.quickAction}>
              <Icon icon={q.icon} tone={q.tone} circle />
              {q.label}
            </button>
          ))}
        </div>
        <div>
          <SectionHeader title="Скоро" action={{ label: 'Все', onClick: () => {} }} />
          <ListGroup>
            <ReminderCard
              compact
              title="Моторное масло"
              state="soon"
              kmText={fmt.nb('через 800 км')}
              timeText={fmt.nb('≈ 19 октября')}
              progressKm={0.92}
              onClick={() => {}}
            />
            <ReminderCard
              compact
              title="ОСАГО"
              state="overdue"
              timeText={fmt.nb('истёк 3 дня назад')}
              progressTime={1.01}
              onClick={() => {}}
            />
            <ReminderCard
              compact
              title="Шиномонтаж"
              state="ok"
              timeText={fmt.nb('через 34 дня')}
              progressTime={0.62}
              onClick={() => {}}
            />
          </ListGroup>
        </div>
        <div>
          <SectionHeader title="Сентябрь" action={{ label: 'Статистика', onClick: () => {} }} />
          <div className={styles.grid2}>
            <StatTile label="Потрачено" value={fmt.rub(48200)} hint={fmt.nb('+12 % к августу')} tone="soon" />
            <StatTile
              label="Расход"
              value={fmt.nb('7,8 л/100 км')}
              hint={fmt.nb('−0,3 к среднему')}
              tone="ok"
            />
          </div>
        </div>
        <div>
          <SectionHeader title="Последние записи" action={{ label: 'Журнал', onClick: () => {} }} />
          <ListGroup>
            <RecordRow
              kind="service"
              icon={<IconTool />}
              title="ТО-6: масло, фильтры, свечи"
              subtitle={`${fmt.km(145100)} · Автосервис на Ленина`}
              amount={fmt.rub(38900)}
              date="12 сен"
              attachments={2}
              onClick={() => {}}
            />
            <RecordRow
              kind="fuel"
              icon={<IconGasStation />}
              title="Заправка"
              subtitle={`АИ-95 · ${fmt.nb('42,5 л')}`}
              amount={fmt.rub(2450)}
              date="9 сен"
              onClick={() => {}}
            />
          </ListGroup>
        </div>
      </div>
      <BottomTabBar items={tabs('home')} onAdd={() => {}} />
    </PhoneFrame>
  )
}

const PLACES: ComboboxOption[] = [
  { id: 'p1', label: 'Автосервис на Ленина', hint: '6 визитов · последний 12.09.2026' },
  { id: 'p2', label: 'Официальный дилер Skoda' },
]

function ServiceFormSketch() {
  const [date, setDate] = useState('2026-09-25')
  const [odo, setOdo] = useState<number | undefined>(148320)
  const [place, setPlace] = useState<ComboboxOption | null>(PLACES[0]!)
  const [query, setQuery] = useState(PLACES[0]!.label)
  const [total, setTotal] = useState<number | undefined>(1035000)
  const q = query.trim().toLowerCase()
  return (
    <PhoneFrame label="Эскиз: форма ТО">
      <AppBar title="Новое ТО" onBack={() => {}} />
      <div className={styles.phoneBody}>
        <TextField label="Название" defaultValue="ТО-7" hint="Прошлое: ТО-6, 12.09.2026" />
        <DateField label="Дата" value={date} onChange={setDate} today="2026-09-25" quick max="2026-09-25" />
        <OdometerField value={odo} onChange={setOdo} lastKnown={`последний: ${fmt.km(148320)}`} />
        <Combobox
          label="Место"
          value={place}
          options={q ? PLACES.filter((p) => p.label.toLowerCase().includes(q)) : PLACES}
          query={query}
          onQueryChange={setQuery}
          onSelect={setPlace}
          onCreate={(label) => setPlace({ id: 'new', label })}
        />
        <Button variant="secondary" block>
          Повторить прошлое ТО
        </Button>
        <RepeatableList title="Работы" addLabel="Добавить работу" onAdd={() => {}} total={fmt.rub(2500)}>
          <LineItemRow
            title="Замена масла и фильтров"
            meta="Работа"
            amount={fmt.rub(2500)}
            onEdit={() => {}}
            onRemove={() => {}}
          />
        </RepeatableList>
        <RepeatableList title="Запчасти" addLabel="Добавить запчасть" onAdd={() => {}} total={fmt.rub(7850)}>
          <LineItemRow
            title="Масло моторное 5W-30"
            meta={`Castrol · 15669E · ${fmt.nb('4 л')}`}
            amount={fmt.rub(3900)}
            onEdit={() => {}}
            onRemove={() => {}}
          />
          <LineItemRow
            title="Масляный фильтр"
            onEdit={() => {}}
            onRemove={() => {}}
            suggestion={{ text: `В прошлый раз: Mann W 712/95, ${fmt.rub(650)}`, onApply: () => {} }}
          />
          <LineItemRow
            title="Свечи зажигания"
            meta={`NGK · ILKAR7L11 · ${fmt.nb('4 шт')}`}
            amount={fmt.rub(3300)}
            onEdit={() => {}}
            onRemove={() => {}}
          />
        </RepeatableList>
        <MoneyField
          label="Итого"
          value={total}
          onChange={setTotal}
          hint="Сумма строк; можно ввести вручную"
        />
      </div>
      <div className={styles.formFooter}>
        <Button block icon={<IconDeviceFloppy />}>
          Сохранить
        </Button>
      </div>
    </PhoneFrame>
  )
}

export function ScreensSection() {
  return (
    <Section
      title="Экраны-эскизы"
      lead="Главная и форма ТО, собранные только из компонентов на выдуманных данных."
    >
      <Demo name="Главная" plain>
        <HomeSketch />
      </Demo>
      <Demo name="Форма ТО" plain>
        <ServiceFormSketch />
      </Demo>
    </Section>
  )
}
