import {
  IconBuildingStore,
  IconCloud,
  IconGasStation,
  IconGauge,
  IconMoon,
  IconNote,
  IconReceipt,
  IconTool,
  IconTrash,
} from '@tabler/icons-react'
import { useState } from 'react'
import {
  Badge,
  Icon,
  ListGroup,
  ListItem,
  MonthHeader,
  RecordRow,
  ReminderCard,
  SectionHeader,
  StatTile,
  Switch,
  VehicleCard,
  VehicleSchematic,
  type SchematicMark,
  type SchematicZone,
} from '../../index'
import { Caption, Demo, fmt, SAMPLE_CAR, Section, Stack } from '../kit'
import styles from '../Showcase.module.css'

const ALL_ZONES: SchematicZone[] = [
  'engine',
  'timing',
  'cooling',
  'battery',
  'brakes',
  'lights',
  'transmission',
  'cabin',
  'wheelFront',
  'wheelRear',
]
const allZones = ALL_ZONES.map((zone, i): SchematicMark => ({ zone, state: i % 2 ? 'soon' : 'overdue' }))

export function ListsSection() {
  const [autoSync, setAutoSync] = useState(true)
  return (
    <Section title="Списки" lead="Белые карточки-группы строк, как в системных настройках.">
      <Demo name="ListGroup и ListItem" plain>
        <ListGroup title="Данные" footer="Копия хранится в папке приложения на Яндекс.Диске." titleLevel={4}>
          <ListItem
            leading={<Icon icon={IconCloud} tone="accent" circle />}
            title="Синхронизация"
            subtitle="Яндекс.Диск · сегодня в 14:20"
            chevron
            onClick={() => {}}
          />
          <ListItem
            leading={<Icon icon={IconBuildingStore} tone="neutral" circle />}
            title="Места и мастера"
            value="12"
            chevron
            href="#/showcase"
          />
          <ListItem title="Тема" value="Как в системе" chevron onClick={() => {}} />
          <Switch
            label="Синхронизировать сразу"
            hint="Иначе — раз в 15 минут"
            checked={autoSync}
            onChange={setAutoSync}
          />
          <ListItem title="Версия" trailing={<Badge>0.1.0</Badge>} />
          <ListItem title="Удалить все данные на устройстве" danger onClick={() => {}} />
        </ListGroup>
      </Demo>

      <Demo name="SectionHeader" plain>
        <SectionHeader title="Скоро" action={{ label: 'Все', onClick: () => {} }} />
        <SectionHeader title="Последние записи" />
      </Demo>

      <Demo name="StatTile" plain>
        <div className={styles.grid2}>
          <StatTile
            label="Потрачено в сентябре"
            value={fmt.rub(18450)}
            hint={fmt.nb('+12 % к августу')}
            tone="soon"
            onClick={() => {}}
          />
          <StatTile
            label="Расход"
            value={fmt.nb('7,8 л/100 км')}
            hint={fmt.nb('−0,3 к среднему')}
            tone="ok"
          />
          <StatTile label="Цена километра" value={fmt.nb('9,40 ₽')} />
          <StatTile label="Пробег за месяц" value={fmt.km(1240)} />
        </div>
      </Demo>

      <Demo
        name="MonthHeader и RecordRow"
        note="Длинный заголовок обрезается, сумма не уезжает. Месяц липнет при прокрутке."
        plain
      >
        <div className={styles.monthScroll}>
          <MonthHeader title="Сентябрь 2026" total={fmt.rub(48200)} />
          <ListGroup>
            <RecordRow
              kind="service"
              icon={<IconTool />}
              title="Замена ремня ГРМ с роликами и помпой в автосервисе на Профсоюзной улице дом 128"
              subtitle={`${fmt.km(145100)} · Автосервис на Профсоюзной улице, дом 128, корпус 2`}
              amount={fmt.rub(38900)}
              date="12 сен"
              attachments={3}
              onClick={() => {}}
            />
            <RecordRow
              kind="fuel"
              icon={<IconGasStation />}
              title="Заправка"
              subtitle={`АИ-95 · ${fmt.nb('42,5 л')} · Лукойл`}
              amount={fmt.rub(2450)}
              date="9 сен"
              onClick={() => {}}
            />
            <RecordRow
              kind="expense"
              icon={<IconReceipt />}
              title="Мойка"
              subtitle="Артикул W712/95-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
              amount={fmt.rub(900)}
              date="5 сен"
            />
            <RecordRow
              kind="odometer"
              icon={<IconGauge />}
              title="Пробег"
              subtitle={fmt.km(148320)}
              date="1 сен"
            />
            <RecordRow kind="note" icon={<IconNote />} title="Стучит справа на кочках" date="1 сен" />
          </ListGroup>
          <MonthHeader title="Август 2026" total={fmt.rub(12700)} />
          <ListGroup>
            <RecordRow
              kind="fuel"
              icon={<IconGasStation />}
              title="Заправка"
              subtitle="АИ-95"
              amount={fmt.rub(2380)}
              date="28 авг"
            />
            <RecordRow
              kind="expense"
              icon={<IconReceipt />}
              title="Страховка КАСКО"
              amount={fmt.rub(10320)}
              date="3 авг"
            />
          </ListGroup>
        </div>
      </Demo>

      <Demo name="ReminderCard" note="Две полоски: по пробегу и по времени; прогноз даты." plain>
        <Stack gap={2}>
          <ReminderCard
            title="Моторное масло"
            state="soon"
            kmText={fmt.nb('через 800 км')}
            timeText={fmt.nb('через 112 дней')}
            progressKm={0.92}
            progressTime={0.69}
            predicted={fmt.nb('≈ 19 октября')}
            lastText={`последняя: 15.01.2026, ${fmt.km(140000)}`}
            onClick={() => {}}
          />
          <ReminderCard
            title="Тормозная жидкость"
            state="overdue"
            kmText="—"
            timeText={fmt.nb('просрочено на 23 дня')}
            progressTime={1.06}
            lastText="последняя: 02.09.2024"
          />
          <ReminderCard
            title="Воздушный фильтр"
            state="ok"
            kmText={`через ${fmt.km(9200)}`}
            timeText={fmt.nb('через 10 месяцев')}
            progressKm={0.39}
            progressTime={0.2}
          />
          <ReminderCard title="Свечи зажигания" state="unknown" kmText="нет данных о прошлой замене" />
        </Stack>
      </Demo>

      <Demo name="ReminderCard compact" note="Строки «Скоро» на главной." plain>
        <ListGroup>
          <ReminderCard
            compact
            title="Моторное масло"
            state="soon"
            kmText={fmt.nb('через 800 км')}
            timeText={fmt.nb('≈ 19 октября')}
            progressKm={0.92}
            progressTime={0.69}
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
          />
        </ListGroup>
      </Demo>

      <Demo name="VehicleCard" plain>
        <Stack gap={2}>
          <VehicleCard
            name="Октавия"
            subtitle="Skoda Octavia 1.4 TSI, 2019"
            plate="А123ВС 77"
            odometer={fmt.km(148320)}
            photoUrl={SAMPLE_CAR}
            onSwitch={() => {}}
          />
          <VehicleCard
            name="Очень длинное название машины для проверки обрезки"
            subtitle="Lada Niva Travel, 2021"
            odometer={fmt.km(32100)}
          />
        </Stack>
      </Demo>

      <Demo
        name="VehicleSchematic"
        note="Чертёж на карточке машины: точки зон, «рентген» узла, до двух выносок, легенда."
        plain
      >
        <Stack gap={2}>
          <VehicleCard
            name="Октавия"
            subtitle="Skoda Octavia 2011"
            odometer={fmt.km(148320)}
            schematic={
              <VehicleSchematic
                model="octavia-a5"
                marks={[
                  {
                    zone: 'brakes',
                    state: 'overdue',
                    title: 'Тормозная жидкость',
                    detail: fmt.nb('просрочено на 40 дней'),
                  },
                  {
                    zone: 'timing',
                    state: 'soon',
                    title: 'Ремень ГРМ',
                    detail: fmt.nb('через 2 000 км · ещё 1'),
                  },
                  { zone: 'wheelFront', state: 'soon' },
                ]}
                counts={{ overdue: 1, soon: 3, ok: 7 }}
                label="Схема машины"
                onClick={() => {}}
              />
            }
          />
          <VehicleCard
            name="Сид"
            subtitle="Kia cee'd SW 2008"
            odometer={fmt.km(201500)}
            schematic={
              <VehicleSchematic
                model="ceed-sw-1"
                marks={[
                  { zone: 'engine', state: 'soon', title: 'Масло', detail: fmt.nb('через 1 200 км') },
                  {
                    zone: 'wheelRear',
                    state: 'overdue',
                    title: 'Задние колодки',
                    detail: fmt.nb('просрочено на 300 км'),
                  },
                ]}
                counts={{ overdue: 1, soon: 1, ok: 9 }}
                label="Схема машины"
                onClick={() => {}}
              />
            }
          />
          <Caption>Все зоны сразу — для сверки точек с картинкой</Caption>
          <VehicleSchematic model="octavia-a5" marks={allZones} label="Все зоны Октавии" />
          <VehicleSchematic model="ceed-sw-1" marks={allZones} label="Все зоны Сида" />
        </Stack>
      </Demo>

      <Demo name="Строка с опасным действием" plain>
        <ListGroup titleLevel={4}>
          <ListItem
            leading={<Icon icon={IconMoon} tone="neutral" circle />}
            title="Тёмная тема"
            value="Как в системе"
            chevron
            onClick={() => {}}
          />
          <ListItem
            leading={<Icon icon={IconTrash} tone="overdue" circle />}
            title="Удалить машину"
            danger
            onClick={() => {}}
          />
        </ListGroup>
      </Demo>
    </Section>
  )
}
