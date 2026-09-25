import { useLayoutEffect, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { ChartCard, chartTheme, type ChartColors } from '../../index'
import { fmt, Section } from '../kit'
import styles from '../Showcase.module.css'

const MONTHS = [
  { m: 'Апр', service: 0, fuel: 9800, expense: 2100 },
  { m: 'Май', service: 14200, fuel: 11200, expense: 1500 },
  { m: 'Июн', service: 0, fuel: 12400, expense: 4800 },
  { m: 'Июл', service: 3100, fuel: 13900, expense: 900 },
  { m: 'Авг', service: 0, fuel: 10100, expense: 2600 },
  { m: 'Сен', service: 38900, fuel: 7400, expense: 1900 },
]

const CONSUMPTION = [
  { d: '02.08', v: 8.1 },
  { d: '11.08', v: 7.6 },
  { d: '19.08', v: 7.9 },
  { d: '28.08', v: 7.2 },
  { d: '05.09', v: 7.5 },
  { d: '09.09', v: 7.8 },
]

/** Ширина контейнера без ResizeObserver-зависимости в тестах (jsdom). */
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

const LEGEND = [
  { key: 'fuel', label: 'Топливо' },
  { key: 'expense', label: 'Прочее' },
  { key: 'service', label: 'ТО и ремонт' },
] as const

const decimal = (v: number) => v.toFixed(1).replace('.', ',')

export function ChartsSection({ theme }: { theme: 'light' | 'dark' }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [c, setC] = useState<ChartColors>(chartTheme.colors)
  const [barRef, barWidth] = useWidth()
  const [lineRef, lineWidth] = useWidth()

  // Recharts пишет цвета в SVG-атрибуты — читаем их из CSS колонки при смене темы.
  useLayoutEffect(() => {
    if (rootRef.current) setC(chartTheme.readFromCss(rootRef.current))
  }, [theme])

  const axis = { stroke: c.grid, tick: { fill: c.text, fontSize: 12 }, tickLine: false }

  return (
    <Section
      title="Графики"
      lead="Цвета графиков берутся из токенов темы; под графиком — таблица точных чисел."
    >
      <div
        ref={rootRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
          marginTop: 'var(--space-4)',
        }}
      >
        <ChartCard
          title="Расходы по месяцам"
          subtitle={`За полгода — ${fmt.rub(MONTHS.reduce((s, m) => s + m.service + m.fuel + m.expense, 0))}`}
          table={
            <table>
              <thead>
                <tr>
                  <th scope="col">Месяц</th>
                  <th scope="col">ТО, ₽</th>
                  <th scope="col">Топливо, ₽</th>
                  <th scope="col">Прочее, ₽</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map((m) => (
                  <tr key={m.m}>
                    <th scope="row">{m.m}</th>
                    <td>{fmt.num(m.service)}</td>
                    <td>{fmt.num(m.fuel)}</td>
                    <td>{fmt.num(m.expense)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ul className={styles.legend} aria-hidden="true">
            {LEGEND.map((l) => (
              <li key={l.key} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: c.kinds[l.key] }} />
                {l.label}
              </li>
            ))}
          </ul>
          <div ref={barRef} className={styles.chartBox}>
            <BarChart
              width={barWidth}
              height={200}
              data={MONTHS}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="m" {...axis} />
              <YAxis
                {...axis}
                width={44}
                tickFormatter={(v: number) => (v ? `${Math.round(v / 1000)}к` : '0')}
              />
              <Bar dataKey="fuel" stackId="a" fill={c.kinds.fuel} isAnimationActive={false} />
              <Bar dataKey="expense" stackId="a" fill={c.kinds.expense} isAnimationActive={false} />
              <Bar
                dataKey="service"
                stackId="a"
                fill={c.kinds.service}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </div>
        </ChartCard>

        <ChartCard
          title="Расход топлива"
          subtitle="л/100 км между полными баками"
          table={
            <table>
              <thead>
                <tr>
                  <th scope="col">Заправка</th>
                  <th scope="col">л/100 км</th>
                </tr>
              </thead>
              <tbody>
                {CONSUMPTION.map((p) => (
                  <tr key={p.d}>
                    <th scope="row">{p.d}</th>
                    <td>{decimal(p.v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <div ref={lineRef} className={styles.chartBox}>
            <LineChart
              width={lineWidth}
              height={180}
              data={CONSUMPTION}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="d" {...axis} />
              <YAxis {...axis} width={36} domain={[6, 9]} ticks={[6, 7, 8, 9]} tickFormatter={decimal} />
              <Line
                type="monotone"
                dataKey="v"
                stroke={c.accent}
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: c.accent, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </div>
        </ChartCard>
      </div>
    </Section>
  )
}
