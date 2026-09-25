import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { usePartsStats, useServiceStats } from '../../db/hooks'
import type { ServiceMonth } from '../../domain/calc/garageStats'
import { NBSP, formatDate, formatKm, formatMoney, formatNumber, pluralize } from '../../domain/format'
import type { ISODate, Vehicle } from '../../domain/types'
import { StatTile } from '../../ui'
import { useLookup } from '../common'
import { monthsBetween } from './periods'
import { RankedCard } from './RankedCard'
import { ServiceMonthsCard } from './ServiceMonthsCard'
import styles from './StatsPage.module.css'

type Range = { from?: ISODate; to?: ISODate }

const VISIT_FORMS: [string, string, string] = ['визит', 'визита', 'визитов']
const REPLACEMENT_FORMS: [string, string, string] = ['замена', 'замены', 'замен']
const LINE_FORMS: [string, string, string] = ['позиция', 'позиции', 'позиций']
const PURCHASE_FORMS: [string, string, string] = ['покупка', 'покупки', 'покупок']

const count = (n: number, forms: [string, string, string]) =>
  `${formatNumber(n)}${NBSP}${pluralize(n, forms)}`
const joinDetail = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' · ')
/** Средний чек — в целых рублях: копейки в среднем ничего не говорят. */
const average = (total: number, visits: number) => (visits > 0 ? Math.round(total / visits / 100) * 100 : 0)

/** Каждый месяц периода — и без ТО (нулями), чтобы на графике не было дыр. */
function fillServiceMonths(months: ServiceMonth[], range: Range): ServiceMonth[] {
  const from = range.from?.slice(0, 7) ?? months[0]?.month
  const to = range.to?.slice(0, 7) ?? months[months.length - 1]?.month
  if (!from || !to) return months
  const known = new Map(months.map((m) => [m.month, m]))
  return monthsBetween(from, to).map((month) => known.get(month) ?? { month, labor: 0, parts: 0, other: 0 })
}

/** «Статистика → Сервис»: работы и запчасти, по месяцам, где обслуживаюсь, мастера. */
export function ServiceTab({ vehicle, range }: { vehicle: Vehicle; range: Range }) {
  const navigate = useNavigate()
  const stats = useServiceStats(vehicle.id, range)
  const lookup = useLookup()
  const months = useMemo(() => (stats ? fillServiceMonths(stats.byMonth, range) : []), [stats, range])
  if (!stats || !lookup) return null
  if (stats.visits === 0) return <p className={styles.note}>За этот период ТО и ремонтов нет</p>

  const placeName = (key: string, placeId?: string) =>
    key === 'diy'
      ? 'Делал сам'
      : key === 'none'
        ? 'Место не указано'
        : (lookup.places.get(placeId ?? '')?.name ?? 'Место удалено')

  return (
    <>
      <div className={styles.tiles}>
        <StatTile label="Работы" value={formatMoney(stats.labor)} />
        <StatTile label="Запчасти" value={formatMoney(stats.parts)} />
        <StatTile label="Визиты" value={formatNumber(stats.visits)} />
        <StatTile label="Средний чек" value={formatMoney(average(stats.total, stats.visits))} />
      </div>
      {months.length >= 2 && <ServiceMonthsCard months={months} />}
      <RankedCard
        title="Где обслуживаюсь"
        viewKey="service.places"
        nameHeader="Место"
        rows={stats.byPlace.map((p) => ({
          key: p.key,
          label: placeName(p.key, p.placeId),
          value: p.total,
          detail: joinDetail(
            count(p.visits, VISIT_FORMS),
            p.visits > 1 && `средний чек ${formatMoney(average(p.total, p.visits))}`,
            `последний ${formatDate(p.lastDate)}`,
          ),
          ...(p.placeId && { onClick: () => void navigate(`/places/${p.placeId}`) }),
        }))}
      />
      {stats.byMaster.length > 0 && (
        <RankedCard
          title="Мастера"
          viewKey="service.masters"
          nameHeader="Мастер"
          rows={stats.byMaster.map((m) => {
            const master = lookup.masters.get(m.masterId)
            const place = master?.placeId ? lookup.places.get(master.placeId)?.name : undefined
            return {
              key: m.masterId,
              label: master?.name ?? 'Мастер удалён',
              value: m.total,
              detail: joinDetail(place, count(m.visits, VISIT_FORMS), `последний ${formatDate(m.lastDate)}`),
              onClick: () => void navigate(`/masters/${m.masterId}`),
            }
          })}
        />
      )}
    </>
  )
}

/** «Статистика → Запчасти»: свои и сервиса, узлы, бренды, где покупал. */
export function PartsTab({ vehicle, range }: { vehicle: Vehicle; range: Range }) {
  const navigate = useNavigate()
  const stats = usePartsStats(vehicle.id, range)
  const lookup = useLookup()
  if (!stats || !lookup) return null
  if (stats.byItem.length === 0) return <p className={styles.note}>За этот период запчастей и работ нет</p>

  const supplierName = (key: string, placeId?: string) =>
    key === 'service'
      ? 'Запчасти сервиса'
      : key === 'own'
        ? 'Купил сам, магазин не указан'
        : (lookup.places.get(placeId ?? '')?.name ?? 'Магазин удалён')

  return (
    <>
      <div className={styles.tiles}>
        <StatTile label="Запчасти" value={formatMoney(stats.total)} />
        <StatTile
          label="Купил сам"
          value={formatMoney(stats.own)}
          hint={
            stats.total > 0 ? `${formatNumber((stats.own / stats.total) * 100)}${NBSP}% запчастей` : undefined
          }
        />
      </div>
      <RankedCard
        title="На что уходит"
        subtitle="Запчасти и работы по узлам"
        viewKey="parts.items"
        nameHeader="Узел"
        rows={stats.byItem.map((i) => ({
          key: i.key,
          label: i.name,
          value: i.total,
          detail: joinDetail(
            count(i.replacements, REPLACEMENT_FORMS),
            i.avgKmBetween !== null && `каждые ${formatKm(i.avgKmBetween)}`,
            i.brands.length > 0 && i.brands.slice(0, 3).join(', '),
          ),
          ...(i.itemId && { onClick: () => void navigate(`/items/${i.itemId}`) }),
        }))}
      />
      {stats.byBrand.length > 0 && (
        <RankedCard
          title="Бренды"
          viewKey="parts.brands"
          nameHeader="Бренд"
          rows={stats.byBrand.map((b) => ({
            key: b.brand,
            label: b.brand,
            value: b.total,
            detail: count(b.lines, LINE_FORMS),
          }))}
        />
      )}
      <RankedCard
        title="Где покупал"
        viewKey="parts.suppliers"
        nameHeader="Где"
        rows={stats.bySupplier.map((s) => ({
          key: s.key,
          label: supplierName(s.key, s.placeId),
          value: s.total,
          detail: count(s.purchases, PURCHASE_FORMS),
          ...(s.placeId && { onClick: () => void navigate(`/places/${s.placeId}`) }),
        }))}
      />
    </>
  )
}
