import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import styles from './Showcase.module.css'

/** Раздел витрины: заголовок h2 и короткое пояснение. */
export function Section({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {lead && <p className={styles.lead}>{lead}</p>}
      {children}
    </section>
  )
}

/** Один компонент в разделе: имя (h3), необязательная заметка, образцы. */
export function Demo({
  name,
  note,
  children,
  plain,
}: {
  name: string
  note?: string
  children: ReactNode
  /** Без белой подложки — для компонентов, у которых она своя. */
  plain?: boolean
}) {
  return (
    <div className={styles.demo}>
      <h3 className={styles.demoName}>{name}</h3>
      {note && <p className={styles.note}>{note}</p>}
      <div className={cx(styles.demoBody, !plain && styles.demoSurface)}>{children}</div>
    </div>
  )
}

export function Row({ children, wrap = true }: { children: ReactNode; wrap?: boolean }) {
  return <div className={cx(styles.row, wrap && styles.wrap)}>{children}</div>
}

export function Stack({ children, gap = 3 }: { children: ReactNode; gap?: 2 | 3 | 4 }) {
  return <div className={cx(styles.stack, styles[`gap${gap}`])}>{children}</div>
}

/** Подпись состояния над образцом. */
export function Caption({ children }: { children: ReactNode }) {
  return <p className={styles.caption}>{children}</p>
}

/** Рамка «экрана телефона» 390 px со своей прокруткой: липкая шапка и нижняя панель липнут к ней. */
export function PhoneFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className={styles.phone} role="group" aria-label={label}>
      <div className={styles.phoneScroll}>{children}</div>
    </div>
  )
}

const NBSP = '\u00A0'
const group = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/\s/g, NBSP)

/** Образцы строк так, как их готовит domain: неразрывные пробелы в числах и перед единицей. */
export const fmt = {
  km: (n: number) => `${group(n)}${NBSP}км`,
  rub: (n: number) => `${group(n)}${NBSP}₽`,
  num: group,
  /** Все пробелы — неразрывные: «7,8 л/100 км», «через 800 км». */
  nb: (s: string) => s.replace(/ /g, NBSP),
}

/** Простой образец фото-чека (SVG), чтобы витрина работала без сети. */
export const SAMPLE_RECEIPT =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400"><rect width="300" height="400" fill="#D9DDE3"/>' +
      '<rect x="60" y="30" width="180" height="340" fill="#FFFFFF"/>' +
      '<g fill="#9AA1AB"><rect x="80" y="60" width="140" height="10"/><rect x="80" y="90" width="100" height="8"/>' +
      '<rect x="80" y="110" width="120" height="8"/><rect x="80" y="130" width="90" height="8"/>' +
      '<rect x="80" y="150" width="130" height="8"/></g><rect x="80" y="310" width="140" height="14" fill="#15181C"/></svg>',
  )

export const SAMPLE_CAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" fill="#C9D3E0"/>' +
      '<rect y="104" width="160" height="56" fill="#9AA6B5"/>' +
      '<path d="M26 104l12-30a14 14 0 0 1 13-9h58a14 14 0 0 1 13 9l12 30v16H26z" fill="#2B3A55"/>' +
      '<rect x="46" y="72" width="68" height="20" rx="4" fill="#DCE6F2"/>' +
      '<circle cx="52" cy="120" r="12" fill="#15181C"/><circle cx="108" cy="120" r="12" fill="#15181C"/></svg>',
  )
