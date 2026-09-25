import { useId } from 'react'
import { useNavigate } from 'react-router'
import { useVehicles, type VisitStats } from '../../db/hooks'
import { formatDate, formatKm, formatMoney, formatNumber } from '../../domain/format'
import type { CarRecord, Kopecks, Rating as Stars } from '../../domain/types'
import { ListGroup, Rating, RecordRow, StatTile } from '../../ui'
import { recordRowProps, recordSubtitle, useLookup } from '../common'
import styles from './places.module.css'

/** Оценка в форме: подпись как у полей и звёзды. */
export function RatingField({ value, onChange }: { value?: Stars; onChange(v?: Stars): void }) {
  return (
    <div className={styles.ratingField}>
      <span className={styles.fieldLabel} aria-hidden="true">
        Оценка
      </span>
      <Rating value={value} onChange={onChange} />
    </div>
  )
}

/** Визиты, всего потрачено, средний чек, последний визит — по всем машинам. */
export function VisitStatsSection({ stats }: { stats: VisitStats | undefined }) {
  const titleId = useId()
  if (!stats) return null
  const none = stats.visits === 0
  return (
    <section className={styles.stats} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.groupTitle}>
        Статистика
      </h2>
      <div className={styles.tiles}>
        <StatTile label="Визиты" value={formatNumber(stats.visits)} />
        <StatTile label="Всего потрачено" value={formatMoney(stats.total)} />
        <StatTile label="Средний чек" value={none ? '—' : formatMoney(stats.average)} />
        <StatTile label="Последний визит" value={stats.lastDate ? formatDate(stats.lastDate) : '—'} />
      </div>
    </section>
  )
}

export interface VisitsListProps {
  records: CarRecord[] | undefined
  /** Сколько потрачено у этого места/мастера в записи — как в статистике (`placeSpend`/`masterSpend`). */
  spend(r: CarRecord): Kopecks | null
  /** Подпись места в строке — на карточке мастера; на карточке места она лишняя. */
  showPlace?: boolean
}

/** Визиты по всем машинам: строки журнала, в подзаголовке — машина. */
export function VisitsList({ records, spend, showPlace }: VisitsListProps) {
  const navigate = useNavigate()
  const lookup = useLookup()
  const vehicles = useVehicles({ includeArchived: true })
  if (!records || records.length === 0) return null
  const names = new Map(vehicles?.map((v) => [v.id, v.name]))
  return (
    <ListGroup title="Визиты">
      {records.map((r) => {
        const row = recordRowProps(r, lookup, { onClick: () => void navigate(`/record/${r.id}`) })
        const where = showPlace
          ? recordSubtitle(r, lookup)
          : r.odometer !== undefined
            ? formatKm(r.odometer)
            : undefined
        const amount = spend(r)
        return (
          <RecordRow
            key={r.id}
            {...row}
            subtitle={[names.get(r.vehicleId), where].filter(Boolean).join(' · ') || undefined}
            amount={amount ? formatMoney(amount) : undefined}
          />
        )
      })}
    </ListGroup>
  )
}
