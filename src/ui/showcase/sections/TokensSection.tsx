import { useLayoutEffect, useRef, useState } from 'react'
import { contrastRatio } from '../../lib/contrast'
import { Demo, fmt, Section, Stack } from '../kit'
import styles from '../Showcase.module.css'

type Pair = { fg: string; bg: string; min: 3 | 4.5 }

/** Пары «цвет — фон», как их используют компоненты (те же, что проверяет contrast.test.ts). */
const GROUPS: { name: string; pairs: Pair[] }[] = [
  {
    name: 'Текст и поверхности',
    pairs: [
      { fg: '--color-text', bg: '--color-bg', min: 4.5 },
      { fg: '--color-text', bg: '--color-surface', min: 4.5 },
      { fg: '--color-text-2', bg: '--color-bg', min: 4.5 },
      { fg: '--color-text-2', bg: '--color-surface-2', min: 4.5 },
      { fg: '--color-border-strong', bg: '--color-surface', min: 3 },
      { fg: '--color-on-inverse', bg: '--color-inverse-surface', min: 4.5 },
    ],
  },
  {
    name: 'Акцент',
    pairs: [
      { fg: '--color-accent', bg: '--color-surface', min: 4.5 },
      { fg: '--color-accent', bg: '--color-accent-soft', min: 4.5 },
      { fg: '--color-on-accent', bg: '--color-accent-fill', min: 4.5 },
      { fg: '--color-inverse-accent', bg: '--color-inverse-surface', min: 4.5 },
    ],
  },
  {
    name: 'Статусы — всегда вместе со словом',
    pairs: [
      { fg: '--color-ok', bg: '--color-ok-soft', min: 4.5 },
      { fg: '--color-soon', bg: '--color-soon-soft', min: 4.5 },
      { fg: '--color-overdue', bg: '--color-overdue-soft', min: 4.5 },
    ],
  },
  {
    name: 'Типы записей — значок в кружке',
    pairs: [
      { fg: '--kind-service', bg: '--kind-service-soft', min: 3 },
      { fg: '--kind-fuel', bg: '--kind-fuel-soft', min: 3 },
      { fg: '--kind-expense', bg: '--kind-expense-soft', min: 3 },
      { fg: '--kind-odometer', bg: '--kind-odometer-soft', min: 3 },
      { fg: '--kind-note', bg: '--kind-note-soft', min: 3 },
    ],
  },
]

const TYPE = [
  { token: '--text-2xl', px: 28, weight: 'semibold', sample: fmt.km(148320) },
  { token: '--text-xl', px: 20, weight: 'semibold', sample: 'Скоро' },
  { token: '--text-lg', px: 17, weight: 'regular', sample: 'Места и мастера' },
  { token: '--text-md', px: 15, weight: 'medium', sample: 'Замена масла и фильтров' },
  { token: '--text-sm', px: 13, weight: 'regular', sample: `${fmt.km(145100)} · Автосервис на Ленина` },
  { token: '--text-xs', px: 12, weight: 'medium', sample: 'Журнал' },
]

const SPACES = [1, 2, 3, 4, 5, 6, 7, 8]
const SPACE_PX = [4, 8, 12, 16, 20, 24, 32, 40]
const RADII = [
  ['--radius-sm', '8'],
  ['--radius-md', '12'],
  ['--radius-lg', '16'],
  ['--radius-full', '999'],
] as const

function safeRatio(fg: string | undefined, bg: string | undefined): number | null {
  if (!fg || !bg) return null
  try {
    return contrastRatio(fg, bg)
  } catch {
    return null
  }
}

function verdict(ratio: number, min: number): string {
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return min === 3 ? 'AA для значков' : 'мало для текста'
  return 'мало'
}

export function TokensSection({ theme }: { theme: 'light' | 'dark' }) {
  const ref = useRef<HTMLDivElement>(null)
  const [values, setValues] = useState<Record<string, string>>({})

  // Значения читаются из вычисленных стилей колонки — так видно, что тема работает на любом элементе.
  useLayoutEffect(() => {
    if (!ref.current) return
    const cs = getComputedStyle(ref.current)
    const names = new Set(GROUPS.flatMap((g) => g.pairs.flatMap((p) => [p.fg, p.bg])))
    setValues(Object.fromEntries([...names].map((n) => [n, cs.getPropertyValue(n).trim()])))
  }, [theme])

  return (
    <Section
      title="Токены"
      lead="Цвета тем, шрифт Onest, сетка отступов 4 px, радиусы. Контраст считается вживую."
    >
      <div ref={ref}>
        {GROUPS.map((g) => (
          <Demo key={g.name} name={g.name} plain>
            <div className={styles.swatches}>
              {g.pairs.map((p) => {
                const fg = values[p.fg]
                const bg = values[p.bg]
                const ratio = safeRatio(fg, bg)
                return (
                  <div key={p.fg + p.bg} className={styles.swatch}>
                    <div
                      className={styles.chip}
                      style={{ background: `var(${p.bg})`, color: `var(${p.fg})` }}
                    >
                      Аа {ratio ? ratio.toFixed(2).replace('.', ',') : ''}
                    </div>
                    <div className={styles.swatchInfo}>
                      <span className={styles.swatchName}>{p.fg.replace('--', '')}</span>
                      <span className={styles.swatchMeta}>
                        {fg || '—'} на {p.bg.replace('--', '')}
                      </span>
                      <span className={styles.swatchMeta}>{ratio ? verdict(ratio, p.min) : '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Demo>
        ))}

        <Demo name="Типографика" note="Onest; числа — tabular-nums, разряды — неразрывный пробел.">
          <div>
            {TYPE.map((t) => (
              <div key={t.token} className={styles.typeRow}>
                <span
                  style={{
                    fontSize: `var(${t.token})`,
                    fontWeight: `var(--weight-${t.weight})`,
                    lineHeight: 'var(--leading-tight)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {t.sample}
                </span>
                <span className={styles.typeMeta}>
                  {t.px} · {t.weight}
                </span>
              </div>
            ))}
          </div>
        </Demo>

        <Demo name="Отступы" note="Сетка 4 px: --space-1 … --space-8. Цель касания --tap = 44 px.">
          <Stack gap={2}>
            {SPACES.map((s, i) => (
              <div key={s} className={styles.spaceRow}>
                <span style={{ width: 72 }}>--space-{s}</span>
                <span className={styles.spaceBar} style={{ width: `var(--space-${s})` }} />
                <span>{SPACE_PX[i]}</span>
              </div>
            ))}
          </Stack>
        </Demo>

        <Demo name="Радиусы и тени" note="Тени только у шторок и кнопки «+».">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            {RADII.map(([token, px]) => (
              <div key={token} className={styles.radiusBox} style={{ borderRadius: `var(${token})` }}>
                {px}
              </div>
            ))}
            <div
              className={styles.radiusBox}
              style={{ borderRadius: 'var(--radius-full)', boxShadow: 'var(--shadow-fab)', border: 0 }}
            >
              fab
            </div>
          </div>
        </Demo>
      </div>
    </Section>
  )
}
