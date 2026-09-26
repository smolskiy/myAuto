import { IconMapPin, IconMapSearch, IconPhone, IconPlus, IconTool, IconWheel } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { usePlaces } from '../../db/hooks'
import { repos } from '../../db/repos'
import { formatDate, formatNumber, NBSP, pluralize } from '../../domain/format'
import {
  isKnownPlace,
  placeFromDirectory,
  searchDirectory,
  type DirectoryCityId,
  type DirectoryKind,
  type DirectoryPlace,
} from '../../domain/placeDirectory'
import type { Place } from '../../domain/types'
import {
  BottomSheet,
  Button,
  EmptyState,
  Icon,
  ListGroup,
  ListItem,
  SearchField,
  SegmentedControl,
  useToast,
} from '../../ui'
import { DirectoryCityField, Page, useDirectory, useDirectoryCity } from '../common'
import { SAVE_FAILED, userMessage } from '../common/errors'
import { telHref } from './links'
import styles from './places.module.css'

type KindFilter = 'all' | DirectoryKind
const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'service', label: 'СТО' },
  { value: 'tire', label: 'Шины' },
]

/** Строк в списке — не больше: дальше находится поиском. */
const LIMIT = 50
const PLACE_FORMS: [string, string, string] = ['место', 'места', 'мест']

/** `/places/directory` — СТО и шиномонтажи города из Яндекс Карт: поиск, звонок, карта, «Добавить в мои места». */
export default function DirectoryPage() {
  const city = useDirectoryCity()
  return (
    <Page title="Справочник СТО" back="/places">
      <DirectoryCityField />
      {city ? (
        <CityDirectory key={city} city={city} />
      ) : (
        <EmptyState
          icon={<IconMapSearch />}
          title="Выберите город"
          text="Покажем автосервисы и шиномонтажи с адресами и телефонами, а при вводе места в записи — подскажем их."
        />
      )}
    </Page>
  )
}

function CityDirectory({ city }: { city: DirectoryCityId }) {
  const directory = useDirectory(city)
  const places = usePlaces()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const [open, setOpen] = useState<DirectoryPlace | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  if (!directory || !places) return null

  const found = searchDirectory(directory.places, query, undefined, kind === 'all' ? undefined : kind)
  const shown = found.slice(0, LIMIT)
  const count = `${formatNumber(found.length)}${NBSP}${pluralize(found.length, PLACE_FORMS)}`

  return (
    <>
      <SearchField value={query} onChange={setQuery} placeholder="Название или улица" />
      <SegmentedControl ariaLabel="Вид" value={kind} options={KIND_OPTIONS} onChange={setKind} />
      {found.length === 0 ? (
        <EmptyState
          icon={<IconMapSearch />}
          title="Ничего не найдено"
          text="Попробуйте часть названия или улицу."
        />
      ) : (
        <ListGroup title={found.length > LIMIT ? `${count}, первые ${LIMIT} — уточните поиск` : count}>
          {shown.map((e) => (
            <ListItem
              key={e.id}
              leading={<Icon icon={e.kind === 'tire' ? IconWheel : IconTool} tone="accent" circle />}
              title={e.name}
              subtitle={e.address || e.phones[0]}
              value={isKnownPlace(e, places) ? 'В моих' : undefined}
              chevron
              onClick={() => {
                setOpen(e)
                setSheetOpen(true)
              }}
            />
          ))}
        </ListGroup>
      )}
      <p className={styles.caption}>
        {`Данные Яндекс Карт на ${formatDate(directory.updated, 'long')} — телефон и адрес лучше уточнить.`}
      </p>
      {open && (
        <DirectorySheet entry={open} places={places} open={sheetOpen} onClose={() => setSheetOpen(false)} />
      )}
    </>
  )
}

function DirectorySheet({
  entry,
  places,
  open,
  onClose,
}: {
  entry: DirectoryPlace
  places: Place[]
  open: boolean
  onClose(): void
}) {
  const navigate = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const mine = places.find((p) => isKnownPlace(entry, [p]))

  const add = async () => {
    setBusy(true)
    try {
      const place = await repos.places.create(placeFromDirectory(entry))
      toast.show({ text: 'Место добавлено' })
      void navigate(`/places/${place.id}`)
    } catch (e) {
      toast.show({ text: userMessage(e, SAVE_FAILED) })
      setBusy(false)
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={entry.name}
      footer={
        mine ? (
          <Button block variant="secondary" onClick={() => void navigate(`/places/${mine.id}`)}>
            Открыть в моих местах
          </Button>
        ) : (
          <Button block icon={<IconPlus />} loading={busy} onClick={() => void add()}>
            Добавить в мои места
          </Button>
        )
      }
    >
      <ListGroup>
        <ListItem
          leading={<Icon icon={IconMapPin} tone="accent" circle />}
          title={entry.address || 'Адрес не указан'}
          subtitle="Открыть на Яндекс Картах"
          href={entry.url}
          external
        />
        {entry.phones.map((phone) => (
          <ListItem
            key={phone}
            leading={<Icon icon={IconPhone} tone="accent" circle />}
            title={phone}
            subtitle="Позвонить"
            href={telHref(phone)}
          />
        ))}
      </ListGroup>
    </BottomSheet>
  )
}
