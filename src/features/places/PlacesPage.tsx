import { IconMapPin, IconPlus, IconUser } from '@tabler/icons-react'
import { useNavigate, useSearchParams } from 'react-router'
import { useMasters, usePlaces, usePlaceStats } from '../../db/hooks'
import { formatMoney, formatNumber, NBSP, pluralize } from '../../domain/format'
import type { Master, Place, PlaceKind } from '../../domain/types'
import { Button, EmptyState, ListGroup, ListItem, SegmentedControl } from '../../ui'
import { MISSING_PLACE, Page, PLACE_KIND_LABELS } from '../common'
import { RatingMark } from '../garage/RowText'

type Tab = 'places' | 'masters'

const TABS: { value: Tab; label: string }[] = [
  { value: 'places', label: 'Места' },
  { value: 'masters', label: 'Мастера' },
]

const VISIT_FORMS: [string, string, string] = ['визит', 'визита', 'визитов']
const KINDS = Object.keys(PLACE_KIND_LABELS) as PlaceKind[]

function PlaceRow({ place, onOpen }: { place: Place; onOpen(): void }) {
  const stats = usePlaceStats(place.id)
  const subtitle = !stats
    ? undefined
    : stats.visits === 0
      ? 'Нет визитов'
      : `${formatNumber(stats.visits)}${NBSP}${pluralize(stats.visits, VISIT_FORMS)} · ${formatMoney(stats.total)}`
  return (
    <ListItem
      title={place.name}
      subtitle={subtitle}
      trailing={place.rating ? <RatingMark value={place.rating} /> : undefined}
      chevron
      onClick={onOpen}
    />
  )
}

function MasterRow({ master, placeName, onOpen }: { master: Master; placeName?: string; onOpen(): void }) {
  return (
    <ListItem
      title={master.name}
      subtitle={[placeName, master.specialization?.trim()].filter(Boolean).join(' · ') || undefined}
      trailing={master.rating ? <RatingMark value={master.rating} /> : undefined}
      chevron
      onClick={onOpen}
    />
  )
}

/** Справочник мест (группами по виду, с визитами и тратами) и мастеров. */
export default function PlacesPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'masters' ? 'masters' : 'places'
  const setTab = (t: Tab) => setParams(t === 'masters' ? { tab: t } : {}, { replace: true })

  return (
    <Page title="Места и мастера" back="/more">
      <SegmentedControl ariaLabel="Раздел" value={tab} options={TABS} onChange={setTab} />
      {tab === 'places' ? (
        <PlacesList
          onOpen={(id) => void navigate(`/places/${id}`)}
          onAdd={() => void navigate('/places/new')}
        />
      ) : (
        <MastersList
          onOpen={(id) => void navigate(`/masters/${id}`)}
          onAdd={() => void navigate('/masters/new')}
        />
      )}
    </Page>
  )
}

function PlacesList({ onOpen, onAdd }: { onOpen(id: string): void; onAdd(): void }) {
  const places = usePlaces()
  if (!places) return null
  const add = (
    <Button variant="secondary" block icon={<IconPlus />} onClick={onAdd}>
      Добавить место
    </Button>
  )
  if (places.length === 0) {
    return (
      <EmptyState
        icon={<IconMapPin />}
        title="Мест пока нет"
        text="СТО, АЗС и магазины появляются здесь, когда вы указываете их в записях."
        action={add}
      />
    )
  }
  return (
    <>
      {KINDS.map((kind) => {
        const rows = places.filter((p) => p.kind === kind)
        if (rows.length === 0) return null
        return (
          <ListGroup key={kind} title={PLACE_KIND_LABELS[kind]}>
            {rows.map((p) => (
              <PlaceRow key={p.id} place={p} onOpen={() => onOpen(p.id)} />
            ))}
          </ListGroup>
        )
      })}
      {add}
    </>
  )
}

function MastersList({ onOpen, onAdd }: { onOpen(id: string): void; onAdd(): void }) {
  const masters = useMasters()
  // Живые места: мастер удалённого места показывает «Место удалено», а не старое имя.
  const places = usePlaces()
  if (!masters) return null
  const add = (
    <Button variant="secondary" block icon={<IconPlus />} onClick={onAdd}>
      Добавить мастера
    </Button>
  )
  if (masters.length === 0) {
    return (
      <EmptyState
        icon={<IconUser />}
        title="Мастеров пока нет"
        text="Мастер помогает найти, кто делал работу, и позвонить ему."
        action={add}
      />
    )
  }
  return (
    <>
      <ListGroup>
        {masters.map((m) => (
          <MasterRow
            key={m.id}
            master={m}
            placeName={
              m.placeId && places
                ? (places.find((p) => p.id === m.placeId)?.name ?? MISSING_PLACE)
                : undefined
            }
            onOpen={() => onOpen(m.id)}
          />
        ))}
      </ListGroup>
      {add}
    </>
  )
}
