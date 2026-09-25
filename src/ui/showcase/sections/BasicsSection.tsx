import {
  IconCar,
  IconDeviceFloppy,
  IconGasStation,
  IconGauge,
  IconNote,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconSettings,
  IconTool,
  IconTrash,
  IconFilter,
} from '@tabler/icons-react'
import { useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Icon,
  IconButton,
  ProgressBar,
  SegmentedControl,
  Skeleton,
  Spinner,
  StatusPill,
} from '../../index'
import { Caption, Demo, Row, Section, Stack } from '../kit'

export function BasicsSection() {
  const [period, setPeriod] = useState<'month' | 'year' | 'all'>('month')
  const [filters, setFilters] = useState(['Заправки', 'Автосервис на Ленина'])
  const [kind, setKind] = useState<string | null>('fuel')

  return (
    <Section title="Базовые" lead="Кнопки, значки, статусы, чипы, прогресс, пустые состояния.">
      <Demo name="Button" note="primary · secondary · ghost · danger; md 48 px и sm 36 px (касание 44 px).">
        <Stack gap={2}>
          <Button block icon={<IconDeviceFloppy />}>
            Сохранить
          </Button>
          <Row>
            <Button variant="secondary">Повторить прошлое ТО</Button>
            <Button variant="ghost">Отменить</Button>
          </Row>
          <Row>
            <Button variant="danger" icon={<IconTrash />}>
              Удалить
            </Button>
            <Button loading>Сохраняем</Button>
            <Button disabled>Недоступно</Button>
          </Row>
          <Row>
            <Button size="sm" icon={<IconPlus />}>
              Добавить
            </Button>
            <Button size="sm" variant="secondary">
              +500
            </Button>
            <Button size="sm" variant="ghost">
              Все записи
            </Button>
          </Row>
        </Stack>
      </Demo>

      <Demo name="IconButton">
        <Row>
          <IconButton label="Поиск" icon={<IconSearch />} />
          <IconButton label="Фильтры" icon={<IconFilter />} />
          <IconButton label="Настройки" icon={<IconSettings />} variant="filled" />
          <IconButton label="Удалить" icon={<IconTrash />} variant="filled" size="sm" />
        </Row>
      </Demo>

      <Demo name="Icon" note="Значок типа записи в кружке своего тона.">
        <Row>
          <Icon icon={IconTool} tone="service" circle />
          <Icon icon={IconGasStation} tone="fuel" circle />
          <Icon icon={IconReceipt} tone="expense" circle />
          <Icon icon={IconGauge} tone="odometer" circle />
          <Icon icon={IconNote} tone="note" circle />
          <Icon icon={IconCar} tone="accent" circle size={24} />
          <Icon icon={IconCar} size={16} />
        </Row>
      </Demo>

      <Demo name="StatusPill и Badge" note="Цвет статуса всегда рядом со словом и значком.">
        <Row>
          <StatusPill state="ok" />
          <StatusPill state="soon" />
          <StatusPill state="overdue" />
          <StatusPill state="unknown" />
        </Row>
        <Row>
          <Badge>12</Badge>
          <Badge tone="accent">Новое</Badge>
          <Badge tone="ok">Гарантия</Badge>
          <Badge tone="soon">3 дня</Badge>
          <Badge tone="overdue">Истёк</Badge>
        </Row>
      </Demo>

      <Demo name="Chip" note="Фильтры журнала: переключатель, с числом, с удалением.">
        <Row>
          {[
            ['fuel', 'Заправки', 18],
            ['service', 'ТО и ремонт', 7],
            ['expense', 'Расходы', 11],
          ].map(([key, label, count]) => (
            <Chip
              key={key}
              selected={kind === key}
              count={count as number}
              onClick={() => setKind(kind === key ? null : (key as string))}
            >
              {label as string}
            </Chip>
          ))}
        </Row>
        <Row>
          {filters.map((f) => (
            <Chip key={f} selected onRemove={() => setFilters(filters.filter((x) => x !== f))}>
              {f}
            </Chip>
          ))}
          {filters.length === 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setFilters(['Заправки', 'Автосервис на Ленина'])}
            >
              Вернуть фильтры
            </Button>
          )}
        </Row>
      </Demo>

      <Demo name="SegmentedControl" note="Радиогруппа: стрелки двигают выбор.">
        <SegmentedControl
          ariaLabel="Период"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'month', label: 'Месяц' },
            { value: 'year', label: 'Год' },
            { value: 'all', label: 'Всё время' },
          ]}
        />
      </Demo>

      <Demo name="ProgressBar" note="Больше 100 % — полная и красная.">
        <Stack gap={3}>
          <Caption>30 %</Caption>
          <ProgressBar value={0.3} label="Пройдено 30 %" />
          <Caption>92 %, скоро</Caption>
          <ProgressBar value={0.92} tone="soon" label="Пройдено 92 %" />
          <Caption>130 %, просрочено</Caption>
          <ProgressBar value={1.3} label="Пройдено 130 %" />
          <Caption>В порядке</Caption>
          <ProgressBar value={0.45} tone="ok" label="Пройдено 45 %" />
        </Stack>
      </Demo>

      <Demo name="Skeleton и Spinner">
        <Row wrap={false}>
          <Skeleton width={40} height={40} radius="full" />
          <Stack gap={2}>
            <Skeleton width={180} height={14} />
            <Skeleton width={120} height={12} />
          </Stack>
        </Row>
        <Row>
          <Spinner size={16} />
          <Spinner size={24} label="Загрузка" />
        </Row>
      </Demo>

      <Demo name="Card и Divider" plain>
        <Card padded>
          <p>Карточка с отступом 16 px. Без тени — её отделяет фон страницы.</p>
          <div style={{ margin: 'var(--space-3) 0' }}>
            <Divider />
          </div>
          <p style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)' }}>
            Разделитель во всю ширину
          </p>
        </Card>
      </Demo>

      <Demo name="EmptyState">
        <EmptyState
          icon={<IconReceipt />}
          title="Записей пока нет"
          text="Добавьте первую заправку или ТО — здесь появится история машины."
          action={<Button icon={<IconPlus />}>Добавить запись</Button>}
        />
      </Demo>
    </Section>
  )
}
