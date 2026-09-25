import { IconMapPin, IconPhone, IconPlus, IconTrash, IconUser } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMasters, usePlace, usePlaceStats, useRecords } from '../../db/hooks'
import { repos } from '../../db/repos'
import { placeSpend } from '../../domain/calc/visits'
import type { Place, PlaceKind, Rating as Stars } from '../../domain/types'
import { Button, EmptyState, Icon, ListGroup, ListItem, Select, TextArea, TextField } from '../../ui'
import { FormPage, Page, PLACE_KIND_LABELS, useGoBack, useSoftDelete } from '../common'
import { optional } from '../garage/kit'
import { mapsHref, telHref } from './links'
import { RatingMark } from '../garage/RowText'
import { RatingField, VisitsList, VisitStatsSection } from './parts'
import styles from './places.module.css'

const KIND_OPTIONS = (Object.keys(PLACE_KIND_LABELS) as PlaceKind[]).map((k) => ({
  value: k,
  label: PLACE_KIND_LABELS[k],
}))

/** Новое место (`/places/new`) или карточка места с правкой, статистикой, мастерами и визитами. */
export default function PlacePage() {
  const { id } = useParams()
  const place = usePlace(id)
  if (!id) return <PlaceForm />
  if (place === undefined) return null
  if (place === null) {
    return (
      <Page title="Место" back="/places">
        <EmptyState
          icon={<IconMapPin />}
          title="Место не найдено"
          text="Его удалили на этом или другом устройстве."
        />
      </Page>
    )
  }
  return <PlaceForm key={place.id} place={place} />
}

function PlaceForm({ place }: { place?: Place }) {
  const [kind, setKind] = useState<PlaceKind>(place?.kind ?? 'service')
  const [name, setName] = useState(place?.name ?? '')
  const [address, setAddress] = useState(place?.address ?? '')
  const [phone, setPhone] = useState(place?.phone ?? '')
  const [url, setUrl] = useState(place?.url ?? '')
  const [rating, setRating] = useState<Stars | undefined>(place?.rating)
  const [note, setNote] = useState(place?.note ?? '')
  const [nameError, setNameError] = useState<string>()

  const save = async (): Promise<false | void> => {
    if (!name.trim()) {
      setNameError('Добавьте название')
      return false
    }
    const data = {
      kind,
      name: name.trim(),
      address: optional(address),
      phone: optional(phone),
      url: optional(url),
      rating,
      note: optional(note),
    }
    if (place) await repos.places.update(place.id, data)
    else await repos.places.create(data)
  }

  const map = mapsHref(address, url)
  const tel = telHref(phone)

  return (
    <FormPage title={place ? place.name : 'Новое место'} onSave={save}>
      {place && <PlaceStats place={place} />}
      <Select label="Вид" value={kind} options={KIND_OPTIONS} onChange={setKind} />
      <TextField
        label="Название"
        required
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          if (nameError) setNameError(undefined)
        }}
        error={nameError}
        autoComplete="off"
      />
      <TextField
        label="Адрес"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        autoComplete="street-address"
        hint={
          address.trim() && map ? (
            <a className={styles.hintLink} href={map} target="_blank" rel="noreferrer">
              <IconMapPin size={16} aria-hidden="true" />
              Открыть на карте
            </a>
          ) : undefined
        }
      />
      <TextField
        label="Телефон"
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        autoComplete="tel"
        hint={
          tel ? (
            <a className={styles.hintLink} href={tel}>
              <IconPhone size={16} aria-hidden="true" />
              Позвонить
            </a>
          ) : undefined
        }
      />
      <TextField
        label="Ссылка"
        type="url"
        inputMode="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://"
        hint="Сайт или точка на картах — адрес будет открывать её"
      />
      <RatingField value={rating} onChange={setRating} />
      <TextArea label="Заметка" value={note} onChange={(e) => setNote(e.target.value)} />
      {place && <PlaceExtras place={place} />}
    </FormPage>
  )
}

function PlaceStats({ place }: { place: Place }) {
  return <VisitStatsSection stats={usePlaceStats(place.id)} />
}

/** Мастера этого места, визиты по всем машинам и удаление. */
function PlaceExtras({ place }: { place: Place }) {
  const navigate = useNavigate()
  const goBack = useGoBack()
  const softDelete = useSoftDelete()
  const masters = useMasters(place.id)
  const visits = useRecords('all', { placeId: place.id })

  const remove = async () => {
    await softDelete({
      remove: () => repos.places.remove(place.id),
      restore: () => repos.places.restore(place.id),
      text: 'Место удалено',
    })
    goBack('/places')
  }

  return (
    <>
      <ListGroup title="Мастера">
        {(masters ?? []).map((m) => (
          <ListItem
            key={m.id}
            leading={<Icon icon={IconUser} tone="accent" circle />}
            title={m.name}
            subtitle={m.specialization}
            trailing={m.rating ? <RatingMark value={m.rating} /> : undefined}
            chevron
            onClick={() => void navigate(`/masters/${m.id}`)}
          />
        ))}
        <ListItem
          leading={<Icon icon={IconPlus} tone="accent" circle />}
          title="Добавить мастера"
          onClick={() => void navigate(`/masters/new?placeId=${place.id}`)}
        />
      </ListGroup>
      <VisitsList records={visits} spend={(r) => placeSpend(r, place.id)} />
      <Button variant="danger" block icon={<IconTrash />} onClick={() => void remove()}>
        Удалить место
      </Button>
    </>
  )
}
