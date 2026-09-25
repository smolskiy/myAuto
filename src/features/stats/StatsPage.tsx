import { IconChartBar } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useCostBreakdown, useFuelStats, useRecords } from '../../db/hooks'
import { costBreakdown, costPerKm, kmDriven } from '../../domain/calc/costs'
import { NBSP, formatConsumption, formatKm, formatMoney, formatNumber } from '../../domain/format'
import type { CarRecord, ISODate, Vehicle } from '../../domain/types'
import { Button, EmptyState, SegmentedControl, StatTile } from '../../ui'
import { Page, VehicleGate, useToday } from '../common'
import { PERIOD_OPTIONS, periodRange, type PeriodKind } from './periods'
import { FuelChart, GroupsChart, MonthlyChart, YearsTable, useChartColors, type YearRow } from './StatsCharts'
import styles from './StatsPage.module.css'

type Range = { from?: ISODate; to?: ISODate }

const maxISO = (a: ISODate, b: ISODate) => (a > b ? a : b)
const minISO = (a: ISODate, b: ISODate) => (a < b ? a : b)

/** Годы внутри периода (обрезанные его границами) — расходы, пробег и цена км; пустые годы пропускаются. */
function yearRows(records: CarRecord[], range: Range, today: ISODate): YearRow[] {
  const dates = records.map((r) => r.date).sort()
  if (dates.length === 0) return []
  const from = range.from ?? dates[0]!
  const to = range.to ?? maxISO(today, dates[dates.length - 1]!)
  const rows: YearRow[] = []
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    const sub = { from: maxISO(from, `${y}-01-01`), to: minISO(to, `${y}-12-31`) }
    const total = costBreakdown(records, sub).total
    const km = kmDriven(records, sub)
    if (total === 0 && km === null) continue
    rows.push({ year: String(y), total, km, perKm: km ? total / km : null })
  }
  return rows
}

/** «11,6 ₽/км» из копеек на км. */
const perKmText = (kopecksPerKm: number) => `${formatNumber(kopecksPerKm / 100, 1)}${NBSP}₽/км`

function StatsContent({ vehicle }: { vehicle: Vehicle }) {
  const navigate = useNavigate()
  const today = useToday()
  const [period, setPeriod] = useState<PeriodKind>('12m')
  const range = useMemo(() => periodRange(period, today), [period, today])
  // Пробег и цена км считаются по всем записям машины: на границах периода пробег интерполируется.
  const records = useRecords(vehicle.id)
  const costs = useCostBreakdown(vehicle.id, range)
  const fuel = useFuelStats(vehicle.id, range)
  const colors = useChartColors()
  const years = useMemo(() => (records ? yearRows(records, range, today) : []), [records, range, today])
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
  const hasGroups = Object.values(costs.byGroup).some((v) => v > 0)

  return (
    <>
      <div className={styles.period}>
        <SegmentedControl ariaLabel="Период" value={period} options={PERIOD_OPTIONS} onChange={setPeriod} />
      </div>
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
      {costs.byMonth.length >= 2 && <MonthlyChart byMonth={costs.byMonth} colors={colors} />}
      {hasGroups && <GroupsChart byGroup={costs.byGroup} />}
      {fuel.intervals.length >= 2 && <FuelChart intervals={fuel.intervals} colors={colors} />}
      {years.length >= 2 && <YearsTable rows={years} />}
    </>
  )
}

export default function StatsPage() {
  return (
    <Page title="Статистика" back>
      <VehicleGate>{(vehicle) => <StatsContent vehicle={vehicle} />}</VehicleGate>
    </Page>
  )
}
