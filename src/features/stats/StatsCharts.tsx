import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Rectangle,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { COST_GROUP_LABELS, type CostBreakdown, type CostGroup } from '../../domain/calc/costs'
import type { FuelInterval } from '../../domain/calc/fuel'
import {
  NBSP,
  formatConsumption,
  formatDate,
  formatKm,
  formatLiters,
  formatMoney,
  formatNumber,
} from '../../domain/format'
import type { Kopecks } from '../../domain/types'
import { Button, ChartCard, chartTheme, type ChartColors } from '../../ui'
import styles from './StatsCharts.module.css'

// ——— Общее ———

/** Цвета темы для графиков + цвет карточки (кольцо точек линии). */
export type StatsColors = ChartColors & { surface: string }

const LIGHT_SURFACE = '#ffffff'

/** `theme` — только ключ пересчёта: значения берутся из вычисленных стилей <html>. */
function readColors(_theme: string): StatsColors {
  const surface = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim()
  return { ...chartTheme.readFromCss(), surface: surface || LIGHT_SURFACE }
}

/** Тема, уже применённая к <html>: ThemeProvider ставит data-theme в layout-эффекте — после отрисовки детей. */
function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}
const appliedTheme = () => document.documentElement.dataset.theme ?? ''

/**
 * Цвета графиков из токенов темы. Читаются заново, когда на <html> сменилась тема (в том числе системная —
 * пока экран открыт); по `useTheme().resolved` читать рано — атрибут ещё старый.
 */
export function useChartColors(): StatsColors {
  const theme = useSyncExternalStore(subscribeTheme, appliedTheme)
  return useMemo(() => readColors(theme), [theme])
}

/** Ширина контейнера графика; в jsdom (нет размеров) — 320. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setWidth(Math.max(240, Math.floor(el.clientWidth) || 320))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

const MONTH_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

/** '2026-09' → «сен» (или «сен 26», если на графике несколько лет). */
const monthShort = (key: string, withYear: boolean) =>
  `${MONTH_SHORT[Number(key.slice(5, 7)) - 1]}${withYear ? `${NBSP}${key.slice(2, 4)}` : ''}`

/** Рубли без копеек для таблиц и осей: «12 450». */
const rub = (k: Kopecks) => formatNumber(Math.round(k / 100))

/** Подпись оси: «0», «800», «12к». */
const axisRub = (v: number) =>
  Math.abs(v) >= 1000 ? `${formatNumber(v / 1000, v % 1000 ? 1 : 0)}к` : formatNumber(v)

/** «Круглые» деления оси от нуля: шаг 1, 2, 2,5 или 5 × 10ⁿ, не больше `count` интервалов. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((st) => st >= raw)!
  const n = Math.ceil(max / step - 1e-9)
  return Array.from({ length: n + 1 }, (_, i) => i * step)
}

/**
 * Длинная таблица показывает первые `limit` строк (новые сверху) и кнопку «Все … (N)» —
 * вся история заправок за несколько лет не растягивает экран на метры.
 */
function useCollapsed<T>(rows: T[], limit: number, label: string): { visible: T[]; more: ReactNode } {
  const [open, setOpen] = useState(false)
  if (open || rows.length <= limit) return { visible: rows, more: null }
  return {
    visible: rows.slice(0, limit),
    more: (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {`${label} (${rows.length})`}
      </Button>
    ),
  }
}

function axisProps(c: ChartColors) {
  return {
    stroke: c.grid,
    tick: { fill: c.text, fontSize: 12 },
    tickLine: false,
  } as const
}

// ——— По месяцам ———

type Segment = 'fuel' | 'service' | 'official' | 'other'

/**
 * Группы расходов сведены в четыре слоя столбца — больше цветов на телефоне не различить.
 * Цвет слоя постоянен (цвет типа записи), точные суммы по группам — в таблице «На что уходят деньги».
 */
const SEGMENTS: { key: Segment; label: string; color(c: ChartColors): string }[] = [
  { key: 'fuel', label: 'Топливо', color: (c) => c.kinds.fuel },
  { key: 'service', label: 'ТО и ремонт', color: (c) => c.kinds.service },
  { key: 'official', label: 'Страховка и налоги', color: (c) => c.kinds.note },
  { key: 'other', label: 'Прочее', color: (c) => c.kinds.expense },
]

const OFFICIAL: CostGroup[] = ['osago', 'kasko', 'tax', 'inspection', 'registration']

function segmentOf(g: CostGroup): Segment {
  if (g === 'fuel') return 'fuel'
  if (g === 'parts' || g === 'labor' || g === 'serviceOther') return 'service'
  return OFFICIAL.includes(g) ? 'official' : 'other'
}

interface MonthDatum {
  month: string
  label: string
  /** Копейки по слоям — для таблицы и подсказки. */
  sums: Record<Segment, Kopecks>
  total: Kopecks
  /** Рубли по слоям (не меньше нуля) — для столбцов. */
  fuel: number
  service: number
  official: number
  other: number
  /** Нижний и верхний непустые слои: зазор между слоями и скругление вершины. */
  bottom?: Segment
  top?: Segment
}

function monthData(byMonth: CostBreakdown['byMonth']): MonthDatum[] {
  const multiYear = new Set(byMonth.map((m) => m.month.slice(0, 4))).size > 1
  return byMonth.map((m) => {
    const sums: Record<Segment, Kopecks> = { fuel: 0, service: 0, official: 0, other: 0 }
    for (const [g, amount] of Object.entries(m.byGroup) as [CostGroup, Kopecks][])
      sums[segmentOf(g)] += amount
    const present = SEGMENTS.filter((s) => sums[s.key] > 0).map((s) => s.key)
    return {
      month: m.month,
      label: monthShort(m.month, multiYear),
      sums,
      total: m.total,
      fuel: Math.max(0, sums.fuel / 100),
      service: Math.max(0, sums.service / 100),
      official: Math.max(0, sums.official / 100),
      other: Math.max(0, sums.other / 100),
      bottom: present[0],
      top: present[present.length - 1],
    }
  })
}

interface ShapeProps {
  x: number
  y: number
  width: number
  height: number
  fill: string
  payload: MonthDatum
}

/** Слой столбца: 2 px зазора над нижним соседом, скруглённая вершина у верхнего слоя, квадратное основание. */
const segmentShape = (key: Segment) =>
  function SegmentShape(props: unknown) {
    const { x, y, width, height, fill, payload } = props as ShapeProps
    if (!height || height <= 0) return <g />
    const gap = payload.bottom !== key ? 2 : 0
    return (
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={Math.max(0, height - gap)}
        fill={fill}
        radius={payload.top === key ? [4, 4, 0, 0] : 0}
      />
    )
  }

function MonthTip({
  active,
  payload,
  colors,
}: TooltipContentProps<number, string> & { colors: ChartColors }) {
  const d = payload?.[0]?.payload as MonthDatum | undefined
  if (!active || !d) return null
  const [y, m] = d.month.split('-')
  return (
    <div className={styles.tip}>
      <p className={styles.tipTitle}>{`${MONTH_SHORT[Number(m) - 1]} ${y}`}</p>
      {SEGMENTS.filter((s) => d.sums[s.key] !== 0).map((s) => (
        <div key={s.key} className={styles.tipRow}>
          <span className={styles.tipKey} style={{ background: s.color(colors) }} />
          <span className={styles.tipName}>{s.label}</span>
          <span className={styles.tipValue}>{formatMoney(d.sums[s.key])}</span>
        </div>
      ))}
      <div className={styles.tipRow}>
        <span className={styles.tipName}>Всего</span>
        <span className={styles.tipValue}>{formatMoney(d.total)}</span>
      </div>
    </div>
  )
}

export function MonthlyChart({
  byMonth,
  colors,
}: {
  byMonth: CostBreakdown['byMonth']
  colors: ChartColors
}) {
  const [ref, width] = useWidth()
  const data = monthData(byMonth)
  const used = SEGMENTS.filter((s) => data.some((d) => d.sums[s.key] !== 0))
  const ticks = niceTicks(Math.max(...data.map((d) => d.fuel + d.service + d.official + d.other)))
  const { visible, more } = useCollapsed([...data].reverse(), 12, 'Все месяцы')
  const axis = axisProps(colors)
  return (
    <ChartCard
      title="По месяцам"
      subtitle="Расходы по группам, ₽"
      table={
        <>
          <table>
            <thead>
              <tr>
                <th scope="col">Месяц</th>
                <th scope="col">Всего, ₽</th>
                {used.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}, ₽
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((d) => (
                <tr key={d.month}>
                  <th scope="row">{`${MONTH_SHORT[Number(d.month.slice(5, 7)) - 1]} ${d.month.slice(0, 4)}`}</th>
                  <td>{rub(d.total)}</td>
                  {used.map((s) => (
                    <td key={s.key}>{rub(d.sums[s.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {more}
        </>
      }
    >
      <ul className={styles.legend}>
        {used.map((s) => (
          <li key={s.key} className={styles.legendItem}>
            <span className={styles.swatch} style={{ background: s.color(colors) }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div ref={ref} className={styles.box}>
        <BarChart width={width} height={220} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
            cursor={{ fill: colors.grid, opacity: 0.5 }}
            content={(p) => <MonthTip {...(p as TooltipContentProps<number, string>)} colors={colors} />}
          />
          {SEGMENTS.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="month"
              fill={s.color(colors)}
              maxBarSize={24}
              shape={segmentShape(s.key)}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </div>
    </ChartCard>
  )
}

// ——— На что уходят деньги ———

/** «69 %»; ненулевая доля меньше процента — «<1 %», а не «0 %». */
const shareText = (share: number) => (share < 0.005 ? `<1${NBSP}%` : `${formatNumber(share * 100)}${NBSP}%`)

/**
 * Группы по убыванию: таблица, в строках которой — полосы долей. Один ряд — один цвет (акцент);
 * название группы подписано текстом, так что цвет ничего не кодирует.
 */
export function GroupsChart({ byGroup }: { byGroup: CostBreakdown['byGroup'] }) {
  const rows = (Object.entries(byGroup) as [CostGroup, Kopecks][])
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
  const sum = rows.reduce((s, [, amount]) => s + amount, 0)
  const max = rows[0]?.[1] ?? 0
  return (
    <ChartCard title="На что уходят деньги">
      <div className={styles.table}>
        <table>
          <thead>
            <tr>
              <th scope="col">Группа</th>
              <th scope="col">Сумма</th>
              <th scope="col">Доля</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([group, amount]) => (
              <tr key={group}>
                <th scope="row" className={styles.groupName}>
                  {COST_GROUP_LABELS[group]}
                  <span
                    className={styles.bar}
                    style={{ width: `${(amount / max) * 100}%` }}
                    aria-hidden="true"
                  />
                </th>
                <td className={styles.amount}>{formatMoney(amount)}</td>
                <td className={styles.share}>{shareText(amount / sum)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}

// ——— Расход топлива ———

interface FuelDatum {
  label: string
  interval: FuelInterval
  value: number
}

function FuelTip({ active, payload }: TooltipContentProps<number, string>) {
  const d = payload?.[0]?.payload as FuelDatum | undefined
  if (!active || !d) return null
  return (
    <div className={styles.tip}>
      <p
        className={styles.tipTitle}
      >{`${formatDate(d.interval.fromDate)} — ${formatDate(d.interval.toDate)}`}</p>
      <div className={styles.tipRow}>
        <span className={styles.tipValue}>{formatConsumption(d.value)}</span>
      </div>
      <div className={styles.tipRow}>
        <span
          className={styles.tipName}
        >{`${formatKm(d.interval.km)} · ${formatLiters(d.interval.liters)}`}</span>
      </div>
    </div>
  )
}

export function FuelChart({ intervals, colors }: { intervals: FuelInterval[]; colors: StatsColors }) {
  const [ref, width] = useWidth()
  const data: FuelDatum[] = intervals.map((i) => ({
    label: formatDate(i.toDate).slice(0, 5),
    interval: i,
    value: i.lPer100km,
  }))
  const { visible, more } = useCollapsed([...intervals].reverse(), 6, 'Все заправки')
  const values = data.map((d) => d.value)
  const domain = [Math.max(0, Math.floor(Math.min(...values) - 0.5)), Math.ceil(Math.max(...values) + 0.5)]
  const axis = axisProps(colors)
  return (
    <ChartCard
      title="Расход топлива"
      subtitle="л/100 км между полными баками"
      table={
        <>
          <table>
            <thead>
              <tr>
                <th scope="col">Заправка</th>
                <th scope="col">Пробег, км</th>
                <th scope="col">Литры</th>
                <th scope="col">л/100 км</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => (
                <tr key={i.toId}>
                  <th scope="row">{formatDate(i.toDate)}</th>
                  <td>{formatNumber(i.km)}</td>
                  <td>{formatNumber(i.liters, 2).replace(/,?0+$/, '')}</td>
                  <td>{formatNumber(i.lPer100km, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {more}
        </>
      }
    >
      <div ref={ref} className={styles.box}>
        <LineChart width={width} height={180} data={data} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={colors.grid} />
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={12} />
          <YAxis
            {...axis}
            width={36}
            domain={domain}
            allowDecimals={false}
            tickFormatter={(v: number) => formatNumber(v)}
          />
          <Tooltip
            cursor={{ stroke: colors.grid, strokeWidth: 1 }}
            content={(p) => <FuelTip {...(p as TooltipContentProps<number, string>)} />}
          />
          <Line
            type="linear"
            dataKey="value"
            name="Расход"
            stroke={colors.accent}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={{ r: 4, fill: colors.accent, stroke: colors.surface, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: colors.accent, stroke: colors.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </div>
    </ChartCard>
  )
}

// ——— По годам ———

export interface YearRow {
  year: string
  total: Kopecks
  km: number | null
  /** Копеек на км. */
  perKm: number | null
}

/** Таблица «По годам»: расходы, пробег и цена километра. */
export function YearsTable({ rows }: { rows: YearRow[] }) {
  return (
    <ChartCard title="По годам">
      <div className={styles.table}>
        <table>
          <thead>
            <tr>
              <th scope="col">Год</th>
              <th scope="col">Расходы, ₽</th>
              <th scope="col">Пробег, км</th>
              <th scope="col">₽/км</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year}>
                <th scope="row">{r.year}</th>
                <td>{rub(r.total)}</td>
                <td>{r.km !== null ? formatNumber(r.km) : '—'}</td>
                <td>{r.perKm !== null ? formatNumber(r.perKm / 100, 1) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}
