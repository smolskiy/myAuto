import { useId, useState } from 'react'
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { NBSP, formatMoney, formatNumber } from '../../domain/format'
import type { Kopecks } from '../../domain/types'
import { SegmentedControl } from '../../ui'
import styles from './RankedCard.module.css'
import { useChartColors, useWidth } from './StatsCharts'

export interface RankedRow {
  key: string
  label: string
  value: Kopecks
  /** Вторая строка: «5 визитов · средний чек 9 780 ₽». */
  detail?: string
  onClick?(): void
}

export type RankedView = 'list' | 'bars' | 'pie'

const VIEWS: { value: RankedView; label: string }[] = [
  { value: 'list', label: 'Список' },
  { value: 'bars', label: 'Столбцы' },
  { value: 'pie', label: 'Доли' },
]

const STORAGE_PREFIX = 'myauto.stats.view.'

/** Выбранный вид карточки запоминается на устройстве (в приватном режиме — только на время экрана). */
export function useStoredView<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const [view, setView] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + key) as T | null
      return saved && allowed.includes(saved) ? saved : fallback
    } catch {
      return fallback
    }
  })
  const change = (next: T) => {
    setView(next)
    try {
      localStorage.setItem(STORAGE_PREFIX + key, next)
    } catch {
      // Хранилище недоступно — вид просто не запомнится.
    }
  }
  return [view, change] as const
}

/** В столбцах и долях — первые строки, остальное одной строкой: больше на телефоне не различить. */
const BAR_LIMIT = 8
const PIE_LIMIT = 5

/** «69 %»; ненулевая доля меньше процента — «<1 %», а не «0 %». */
const shareText = (share: number) => (share < 0.005 ? `<1${NBSP}%` : `${formatNumber(share * 100)}${NBSP}%`)

/** Подпись столбца: «12,5к» или «800» рублей. */
const shortRub = (k: Kopecks) => {
  const r = k / 100
  return Math.abs(r) >= 1000 ? `${formatNumber(r / 1000, r % 1000 ? 1 : 0)}к` : formatNumber(Math.round(r))
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function top(rows: RankedRow[], limit: number): RankedRow[] {
  if (rows.length <= limit) return rows
  const rest = rows.slice(limit - 1).reduce((s, r) => s + r.value, 0)
  return [...rows.slice(0, limit - 1), { key: 'rest', label: 'Остальное', value: rest }]
}

export interface RankedCardProps {
  title: string
  subtitle?: string
  /** По убыванию; отрицательные и нулевые не показываются. */
  rows: RankedRow[]
  /** Ключ запоминания вида: «service.places». */
  viewKey: string
  defaultView?: RankedView
  /** Подпись колонки названий в таблице: «Группа», «Место». */
  nameHeader?: string
}

/** Рейтинг по сумме с выбором вида: список с полосами, горизонтальные столбцы или доли (кольцо). */
export function RankedCard({
  title,
  subtitle,
  rows,
  viewKey,
  defaultView = 'list',
  nameHeader = 'Название',
}: RankedCardProps) {
  const titleId = useId()
  const [view, setView] = useStoredView<RankedView>(viewKey, defaultView, ['list', 'bars', 'pie'])
  const colors = useChartColors()
  const [ref, width] = useWidth()
  const shown = rows.filter((r) => r.value > 0)
  const sum = shown.reduce((s, r) => s + r.value, 0)
  const max = shown[0]?.value ?? 0
  const pie = top(shown, PIE_LIMIT)
  const bars = top(shown, BAR_LIMIT)
  // Кольцо: цвета рядов по порядку, «Остальное» — нейтральный последний.
  const sliceColor = (r: RankedRow, i: number) =>
    r.key === 'rest'
      ? colors.series[colors.series.length - 1]!
      : colors.series[i % (colors.series.length - 1)]!

  const table = (withSwatch: boolean) => (
    <div className={styles.table}>
      <table>
        <thead>
          <tr>
            <th scope="col">{nameHeader}</th>
            <th scope="col">Сумма</th>
            <th scope="col">Доля</th>
          </tr>
        </thead>
        <tbody>
          {(withSwatch ? pie : shown).map((r, i) => (
            <tr key={r.key}>
              <th scope="row" className={styles.name}>
                <span className={styles.nameLine}>
                  {withSwatch && (
                    <span
                      className={styles.swatch}
                      style={{ background: sliceColor(r, i) }}
                      aria-hidden="true"
                    />
                  )}
                  {r.onClick ? (
                    <button type="button" className={styles.link} onClick={r.onClick}>
                      {r.label}
                    </button>
                  ) : (
                    r.label
                  )}
                </span>
                {r.detail && <span className={styles.detail}>{r.detail}</span>}
                {!withSwatch && (
                  <span
                    className={styles.bar}
                    style={{ width: `${(r.value / max) * 100}%` }}
                    aria-hidden="true"
                  />
                )}
              </th>
              <td className={styles.amount}>{formatMoney(r.value)}</td>
              <td className={styles.share}>{shareText(r.value / sum)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className={styles.empty}>За этот период пусто</p>
      ) : (
        <>
          <SegmentedControl ariaLabel={`${title}: вид`} value={view} options={VIEWS} onChange={setView} />
          {view === 'list' && table(false)}
          {view === 'bars' && (
            <>
              <div ref={ref} className={styles.chart} aria-hidden="true">
                <BarChart
                  width={width}
                  height={bars.length * 34 + 8}
                  data={bars.map((r) => ({ label: clip(r.label, 18), rub: r.value / 100, value: r.value }))}
                  layout="vertical"
                  margin={{ top: 4, right: 48, bottom: 4, left: 0 }}
                >
                  <XAxis type="number" hide domain={[0, 'dataMax']} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={Math.min(150, Math.round(width * 0.42))}
                    tick={{ fill: colors.text, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Bar
                    dataKey="rub"
                    fill={colors.accent}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={20}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v: unknown) => shortRub(Number(v))}
                      style={{ fill: colors.text, fontSize: 12 }}
                    />
                  </Bar>
                </BarChart>
              </div>
              <div className="visually-hidden">{table(false)}</div>
            </>
          )}
          {view === 'pie' && (
            <>
              <div ref={ref} className={styles.pie} aria-hidden="true">
                <PieChart width={Math.min(width, 220)} height={180}>
                  <Pie
                    data={pie.map((r) => ({ name: r.label, value: r.value }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={84}
                    paddingAngle={pie.length > 1 ? 2 : 0}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {pie.map((r, i) => (
                      <Cell key={r.key} fill={sliceColor(r, i)} />
                    ))}
                  </Pie>
                </PieChart>
              </div>
              {table(true)}
            </>
          )}
        </>
      )}
    </section>
  )
}
