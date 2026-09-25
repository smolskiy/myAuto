import { IconPhone, IconTrash, IconUser } from '@tabler/icons-react'
import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useMaster, useMasterStats, useRecords } from '../../db/hooks'
import { repos } from '../../db/repos'
import { masterSpend } from '../../domain/calc/visits'
import type { ID, Master, PlaceKind, Rating as Stars } from '../../domain/types'
import { Button, EmptyState, TextArea, TextField } from '../../ui'
import { FormPage, Page, PlacePicker, useGoBack, useSoftDelete } from '../common'
import { optional, telHref } from './links'
import { RatingField, VisitsList, VisitStatsSection } from './parts'
import styles from './places.module.css'

/** Мастера работают в сервисах, шиномонтажах, мойках; новое место из поля — СТО. */
const MASTER_PLACE_KINDS: PlaceKind[] = ['service', 'tire', 'wash', 'other']

/** Новый мастер (`/masters/new?placeId=…`) или карточка мастера с правкой, статистикой и визитами. */
export default function MasterPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const master = useMaster(id)
  if (!id) return <MasterForm placeId={params.get('placeId') ?? undefined} />
  if (master === undefined) return null
  if (master === null) {
    return (
      <Page title="Мастер" back="/places?tab=masters">
        <EmptyState
          icon={<IconUser />}
          title="Мастер не найден"
          text="Его удалили на этом или другом устройстве."
        />
      </Page>
    )
  }
  return <MasterForm key={master.id} master={master} />
}

function MasterForm({ master, placeId }: { master?: Master; placeId?: ID }) {
  const [name, setName] = useState(master?.name ?? '')
  const [place, setPlace] = useState<ID | undefined>(master?.placeId ?? placeId)
  const [phone, setPhone] = useState(master?.phone ?? '')
  const [specialization, setSpecialization] = useState(master?.specialization ?? '')
  const [rating, setRating] = useState<Stars | undefined>(master?.rating)
  const [note, setNote] = useState(master?.note ?? '')
  const [nameError, setNameError] = useState<string>()

  const save = async () => {
    if (!name.trim()) {
      setNameError('Добавьте имя')
      throw new Error('Добавьте имя')
    }
    const data = {
      name: name.trim(),
      placeId: place,
      phone: optional(phone),
      specialization: optional(specialization),
      rating,
      note: optional(note),
    }
    if (master) await repos.masters.update(master.id, data)
    else await repos.masters.create(data)
  }

  const tel = telHref(phone)

  return (
    <FormPage title={master ? master.name : 'Новый мастер'} onSave={save}>
      {master && <MasterStats master={master} />}
      <TextField
        label="Имя"
        required
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          if (nameError) setNameError(undefined)
        }}
        error={nameError}
        autoComplete="off"
      />
      <PlacePicker label="Место" kinds={MASTER_PLACE_KINDS} value={place} onChange={setPlace} />
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
        label="Специализация"
        value={specialization}
        onChange={(e) => setSpecialization(e.target.value)}
        placeholder="Моторист, электрик, кузовщик"
      />
      <RatingField value={rating} onChange={setRating} />
      <TextArea label="Заметка" value={note} onChange={(e) => setNote(e.target.value)} />
      {master && <MasterExtras master={master} />}
    </FormPage>
  )
}

function MasterStats({ master }: { master: Master }) {
  return <VisitStatsSection stats={useMasterStats(master.id)} />
}

/** Визиты мастера по всем машинам (мастер у записи или у строки работ) и удаление. */
function MasterExtras({ master }: { master: Master }) {
  const goBack = useGoBack()
  const softDelete = useSoftDelete()
  const visits = useRecords('all', { masterId: master.id })

  const remove = async () => {
    await softDelete({
      remove: () => repos.masters.remove(master.id),
      restore: () => repos.masters.restore(master.id),
      text: 'Мастер удалён',
    })
    goBack('/places?tab=masters')
  }

  return (
    <>
      <VisitsList records={visits} spend={(r) => masterSpend(r, master.id)} showPlace />
      <Button variant="danger" block icon={<IconTrash />} onClick={() => void remove()}>
        Удалить мастера
      </Button>
    </>
  )
}
