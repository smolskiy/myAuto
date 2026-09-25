import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import type { ServiceMonth } from '../../domain/calc/garageStats'
import { formatMoney, formatNumber } from '../../domain/format'
import { ChartCard, SegmentedControl } from '../../ui'
import { useStoredView } from './RankedCard'
import { niceTicks, useChartColors, useWidth } from './StatsCharts'
import styles from './StatsCharts.module.css'

type MonthsView = 'bars' | 'line'

const VIEWS: { value: MonthsView; label: string }[] = [
  { value: 'bars', label: 'Столбцы' },
  { value: 'line', label: 'Линия' },
]

const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

const axisRub = (v: number) =>
  Math.abs(v) >= 1000 ? `${formatNumber(v / 1000, v % 1000 ? 1 : 0)}к` : formatNumber(v)

/** Работы и запчасти по месяцам: столбцы стопкой или две линии. Точные суммы — в таблице под графиком. */
export function ServiceMonthsCard({ months }: { months: ServiceMonth[] }) {
  const [view, setView] = useStoredView<MonthsView>('service.months', 'bars', ['bars', 'line'])
  const colors = useChartColors()
  const [ref, width] = useWidth()
  const multiYear = new Set(months.map((m) => m.month.slice(0, 4))).size > 1
  const data = months.map((m) => ({
    label: `${MONTH_SHORT[Number(m.month.slice(5, 7)) - 1]}${multiYear ? ` ${m.month.slice(2, 4)}` : ''}`,
    labor: Math.max(0, m.labor / 100),
    parts: Math.max(0, m.parts / 100),
  }))
  const max = Math.max(
    ...data.map((d) => (view === 'bars' ? d.labor + d.parts : Math.max(d.labor, d.parts))),
    0,
  )
  const ticks = niceTicks(max)
  const laborColor = colors.kinds.service
  const partsColor = colors.kinds.fuel
  const axis = { stroke: colors.grid, tick: { fill: colors.text, fontSize: 12 }, tickLine: false } as const
  const common = { width, height: 200, data, margin: { top: 8, right: 8, bottom: 0, left: 0 } }
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke={colors.grid} />
      <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={8} />
      <YAxis
        {...axis}
        width={44}
        ticks={ticks}
        domain={[0, ticks[ticks.length - 1]!]}
        tickFormatter={axisRub}
      />
      <Tooltip
        formatter={(v: unknown, name: unknown) => [formatMoney(Math.round(Number(v) * 100)), String(name)]}
        cursor={{ fill: colors.grid, opacity: 0.5 }}
      />
    </>
  )
  return (
    <ChartCard
      title="Сервис по месяцам"
      subtitle="Работы и запчасти, ₽"
      action={
        <SegmentedControl
          ariaLabel="Сервис по месяцам: вид"
          value={view}
          options={VIEWS}
          onChange={setView}
        />
      }
      table={
        <table>
          <thead>
            <tr>
              <th scope="col">Месяц</th>
              <th scope="col">Работы</th>
              <th scope="col">Запчасти</th>
            </tr>
          </thead>
          <tbody>
            {/* Месяцы без ТО на графике есть (нулями), в таблице — только с тратами. */}
            {[...months]
              .reverse()
              .filter((m) => m.labor !== 0 || m.parts !== 0)
              .map((m) => (
                <tr key={m.month}>
                  <th scope="row">{`${MONTH_SHORT[Number(m.month.slice(5, 7)) - 1]} ${m.month.slice(0, 4)}`}</th>
                  <td>{formatMoney(m.labor)}</td>
                  <td>{formatMoney(m.parts)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      }
    >
      <ul className={styles.legend}>
        <li className={styles.legendItem}>
          <span className={styles.swatch} style={{ background: laborColor }} />
          Работы
        </li>
        <li className={styles.legendItem}>
          <span className={styles.swatch} style={{ background: partsColor }} />
          Запчасти
        </li>
      </ul>
      <div ref={ref} className={styles.box}>
        {view === 'bars' ? (
          <BarChart {...common}>
            {axes}
            <Bar
              dataKey="labor"
              name="Работы"
              stackId="m"
              fill={laborColor}
              maxBarSize={24}
              isAnimationActive={false}
            />
            <Bar
              dataKey="parts"
              name="Запчасти"
              stackId="m"
              fill={partsColor}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        ) : (
          <LineChart {...common}>
            {axes}
            <Line
              dataKey="labor"
              name="Работы"
              stroke={laborColor}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="parts"
              name="Запчасти"
              stroke={partsColor}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </div>
    </ChartCard>
  )
}
