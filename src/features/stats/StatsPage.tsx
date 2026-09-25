import { IconChartBar } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useCostBreakdown, useFuelStats, useRecords } from '../../db/hooks'
import { costBreakdown, costPerKm, kmDriven, type CostBreakdown } from '../../domain/calc/costs'
import { NBSP, formatConsumption, formatKm, formatMoney, formatNumber } from '../../domain/format'
import type { CarRecord, ISODate, Vehicle } from '../../domain/types'
import { Button, EmptyState, SegmentedControl, StatTile } from '../../ui'
import { Page, VehicleGate, useToday } from '../common'
import { PERIOD_OPTIONS, monthsBetween, periodRange, type PeriodKind } from './periods'
import { COST_GROUP_LABELS, type CostGroup } from '../../domain/calc/costs'
import type { Kopecks } from '../../domain/types'
import { PartsTab, ServiceTab } from './GarageTabs'
import { RankedCard, useStoredView } from './RankedCard'
import { FuelChart, MonthlyChart, YearsTable, useChartColors, type YearRow } from './StatsCharts'
import styles from './StatsPage.module.css'

type Range = { from?: ISODate; to?: ISODate }
type ByMonth = CostBreakdown['byMonth']

/**
 * «По годам» — вся история машины, от года первой записи до текущего, независимо от выбранного периода;
 * годы без расходов и пробега пропускаются. Расходы — за календарный год; текущий год — по сегодня
 * (пробег дальше последней записи не растёт).
 */
function yearRows(records: CarRecord[], today: ISODate): YearRow[] {
  const dates = records.map((r) => r.date).sort()
  if (dates.length === 0) return []
  const last = Math.max(Number(today.slice(0, 4)), Number(dates[dates.length - 1]!.slice(0, 4)))
  const rows: YearRow[] = []
  for (let y = Number(dates[0]!.slice(0, 4)); y <= last; y++) {
    const total = costBreakdown(records, { from: `${y}-01-01`, to: `${y}-12-31` }).total
    // Границы пробега смыкаются (1 января следующего года): иначе теряется пробег 31 декабря и годы не складываются в итог.
    const km = kmDriven(records, { from: `${y}-01-01`, to: `${y + 1}-01-01` })
    if (total === 0 && km === null) continue
    rows.push({ year: String(y), total, km, perKm: km ? total / km : null })
  }
  return rows
}

/**
 * Каждый месяц периода — и без расходов (нулями), чтобы на графике и в таблице не было дыр.
 * Границы — месяцы периода; у «Всего времени» — месяцы первой и последней записи.
 */
function fillMonths(byMonth: ByMonth, range: Range, records: CarRecord[]): ByMonth {
  const dates = records.map((r) => r.date).sort()
  const from = range.from ?? dates[0]
  const to = range.to ?? dates[dates.length - 1]
  if (!from || !to) return byMonth
  const known = new Map(byMonth.map((m) => [m.month, m]))
  return monthsBetween(from.slice(0, 7), to.slice(0, 7)).map(
    (month) => known.get(month) ?? { month, total: 0, byGroup: {} },
  )
}

/** «11,6 ₽/км» из копеек на км. */
const perKmText = (kopecksPerKm: number) => `${formatNumber(kopecksPerKm / 100, 1)}${NBSP}₽/км`

type StatsTab = 'costs' | 'service' | 'parts'

const TABS: { value: StatsTab; label: string }[] = [
  { value: 'costs', label: 'Расходы' },
  { value: 'service', label: 'Сервис' },
  { value: 'parts', label: 'Запчасти' },
]

function StatsContent({ vehicle }: { vehicle: Vehicle }) {
  const navigate = useNavigate()
  const today = useToday()
  const [tab, setTab] = useStoredView<StatsTab>('tab', 'costs', ['costs', 'service', 'parts'])
  const [period, setPeriod] = useState<PeriodKind>('12m')
  const range = useMemo(() => periodRange(period, today), [period, today])
  // Пробег и цена км считаются по всем записям машины: на границах периода пробег интерполируется.
  const records = useRecords(vehicle.id)
  const costs = useCostBreakdown(vehicle.id, range)
  const fuel = useFuelStats(vehicle.id, range)
  const colors = useChartColors()
  const years = useMemo(() => (records ? yearRows(records, today) : []), [records, today])
  const months = useMemo(
    () => (records && costs ? fillMonths(costs.byMonth, range, records) : []),
    [records, costs, range],
  )
  if (!records || !costs || !fuel) return null

  if (records.length === 0) {
    return (
      <EmptyState
        icon={<IconChartBar />}
        title="Статистики пока нет"
        text="Добавьте первые записи — здесь появится статистика"
        action={<Button onClick={() => void navigate('/record/new/fuel')}>Внести заправку</Button>}
      />
    )
  }

  const km = kmDriven(records, range)
  const perKm = costPerKm(records, range)

  return (
    <>
      <SegmentedControl ariaLabel="Раздел статистики" value={tab} options={TABS} onChange={setTab} />
      <div className={styles.period}>
        <SegmentedControl ariaLabel="Период" value={period} options={PERIOD_OPTIONS} onChange={setPeriod} />
      </div>
      {tab === 'service' && <ServiceTab vehicle={vehicle} range={range} />}
      {tab === 'parts' && <PartsTab vehicle={vehicle} range={range} />}
      {tab === 'costs' && <CostsTab {...{ costs, fuel, months, years, colors, perKm, km }} />}
    </>
  )
}

interface CostsTabProps {
  costs: CostBreakdown
  fuel: NonNullable<ReturnType<typeof useFuelStats>>
  months: ByMonth
  years: YearRow[]
  colors: ReturnType<typeof useChartColors>
  perKm: number | null
  km: number | null
}

/** «Статистика → Расходы»: плитки, по месяцам, на что уходят деньги, расход топлива, по годам. */
function CostsTab({ costs, fuel, months, years, colors, perKm, km }: CostsTabProps) {
  const hasGroups = Object.values(costs.byGroup).some((v) => v > 0)
  return (
    <>
      <div className={styles.tiles}>
        <StatTile label="Всего" value={formatMoney(costs.total)} />
        <StatTile label="Цена километра" value={perKm !== null ? perKmText(perKm) : '—'} />
        <StatTile
          label="Средний расход"
          value={fuel.average !== null ? formatConsumption(fuel.average) : '—'}
        />
        <StatTile label="Пробег за период" value={km !== null ? formatKm(km) : '—'} />
      </div>
      {!hasGroups && fuel.intervals.length === 0 && (
        <p className={styles.note}>За этот период расходов нет</p>
      )}
      {costs.byMonth.length > 0 && months.length >= 2 && <MonthlyChart byMonth={months} colors={colors} />}
      {hasGroups && (
        <RankedCard
          title="На что уходят деньги"
          viewKey="costs.groups"
          nameHeader="Группа"
          rows={(Object.entries(costs.byGroup) as [CostGroup, Kopecks][])
            .sort((a, b) => b[1] - a[1])
            .map(([group, amount]) => ({ key: group, label: COST_GROUP_LABELS[group], value: amount }))}
        />
      )}
      {fuel.intervals.length >= 2 && <FuelChart intervals={fuel.intervals} colors={colors} />}
      {years.length >= 2 && <YearsTable rows={years} />}
    </>
  )
}

export default function StatsPage() {
  return (
    <Page title="Статистика" back="/more">
      <VehicleGate>{(vehicle) => <StatsContent vehicle={vehicle} />}</VehicleGate>
    </Page>
  )
}
