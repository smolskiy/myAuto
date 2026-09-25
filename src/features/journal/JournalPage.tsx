import {
  IconAdjustmentsHorizontal,
  IconList,
  IconPlus,
  IconRepeat,
  IconSearch,
  IconTrash,
} from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AddRecordSheet } from '../../app/AddRecordSheet'
import { useRecords } from '../../db/hooks'
import { db } from '../../db/instance'
import { repos } from '../../db/repos'
import { formatMoney, formatMonth } from '../../domain/format'
import type { CarRecord, ID, RecordKind, Vehicle } from '../../domain/types'
import { syncEngine } from '../../sync/index'
import {
  Button,
  Chip,
  EmptyState,
  ListGroup,
  MonthHeader,
  PullToRefresh,
  RecordRow,
  SearchField,
  SwipeRow,
} from '../../ui'
import {
  Page,
  RECORD_KIND_LABELS,
  recordRowProps,
  useLookup,
  useSoftDelete,
  useToday,
  VehicleGate,
} from '../common'
import { useRepeatRecord } from '../records/repeat'
import { groupByMonth } from './groupByMonth'
import {
  EMPTY_FILTER,
  isFiltered,
  JournalFilters,
  PERIOD_LABELS,
  readFilter,
  sheetFilterCount,
  toRecordFilter,
  writeFilter,
  type JournalFilter,
} from './JournalFilters'
import styles from './JournalPage.module.css'

const KINDS = Object.keys(RECORD_KIND_LABELS) as RecordKind[]
const SEARCH_DELAY = 200

/** Число фото и файлов у каждой записи — скрепка в строке журнала. */
function useRecordAttachmentCounts(): Map<ID, number> | undefined {
  return useLiveQuery(async () => {
    const rows = await db.attachments.filter((a) => a.ownerType === 'record' && !a.deleted).toArray()
    const counts = new Map<ID, number>()
    for (const a of rows) counts.set(a.ownerId, (counts.get(a.ownerId) ?? 0) + 1)
    return counts
  }, [])
}

function Journal({ vehicle }: { vehicle: Vehicle }) {
  const navigate = useNavigate()
  const today = useToday()
  const lookup = useLookup()
  const counts = useRecordAttachmentCounts()
  const softDelete = useSoftDelete()
  const repeat = useRepeatRecord()
  const [params, setParams] = useSearchParams()
  const filter = useMemo(() => readFilter(params), [params])
  const [text, setText] = useState(filter.q)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetKey, setSheetKey] = useState(0)
  const [adding, setAdding] = useState(false)

  const apply = (f: JournalFilter) => setParams(writeFilter(f), { replace: true })

  // Поиск — с задержкой: запрос к базе не на каждую букву.
  useEffect(() => {
    if (text === filter.q) return
    const t = setTimeout(() => apply({ ...filter, q: text }), SEARCH_DELAY)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ждём паузы в наборе, фильтр берём свежий
  }, [text])

  const records = useRecords(vehicle.id, toRecordFilter(filter, today))
  const groups = useMemo(() => (records ? groupByMonth(records) : undefined), [records])

  const toggleKind = (k: RecordKind) =>
    apply({
      ...filter,
      kinds: filter.kinds.includes(k) ? filter.kinds.filter((x) => x !== k) : [...filter.kinds, k],
    })

  const reset = () => {
    setText('')
    apply(EMPTY_FILTER)
  }

  const remove = (r: CarRecord) =>
    void softDelete({
      remove: () => repos.records.remove(r.id),
      restore: () => repos.records.restore(r.id),
      text: 'Запись удалена',
    })

  const openSheet = () => {
    setSheetKey((k) => k + 1)
    setSheetOpen(true)
  }

  const sheetCount = sheetFilterCount(filter)
  const itemName = filter.itemId ? lookup?.catalog.get(filter.itemId)?.name : undefined
  const placeName = filter.placeId ? lookup?.places.get(filter.placeId)?.name : undefined

  return (
    <>
      <div className={styles.controls}>
        <SearchField value={text} onChange={setText} />
        <div className={styles.chipRow}>
          <Chip
            icon={<IconAdjustmentsHorizontal />}
            selected={sheetCount > 0}
            count={sheetCount || undefined}
            onClick={openSheet}
          >
            Фильтры
          </Chip>
          {filter.itemId && (
            <Chip onRemove={() => apply({ ...filter, itemId: undefined })}>{itemName ?? 'Узел'}</Chip>
          )}
          {filter.placeId && (
            <Chip onRemove={() => apply({ ...filter, placeId: undefined })}>{placeName ?? 'Место'}</Chip>
          )}
          {filter.period !== 'all' && (
            <Chip onRemove={() => apply({ ...filter, period: 'all', from: undefined, to: undefined })}>
              {PERIOD_LABELS[filter.period]}
            </Chip>
          )}
          {KINDS.map((k) => (
            <Chip key={k} selected={filter.kinds.includes(k)} onClick={() => toggleKind(k)}>
              {RECORD_KIND_LABELS[k]}
            </Chip>
          ))}
        </div>
      </div>

      <PullToRefresh onRefresh={() => syncEngine.syncNow('pull')}>
        {groups === undefined ? null : groups.length === 0 ? (
          isFiltered(filter) || text.trim() ? (
            <EmptyState
              icon={<IconSearch />}
              title="Ничего не найдено"
              text="Измените поиск или фильтры."
              action={
                <Button variant="secondary" onClick={reset}>
                  Сбросить фильтры
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<IconList />}
              title="Записей пока нет"
              text="ТО, заправки, расходы и заметки появятся здесь по месяцам."
              action={
                <Button icon={<IconPlus />} onClick={() => setAdding(true)}>
                  Добавить запись
                </Button>
              }
            />
          )
        ) : (
          <div className={styles.months}>
            {groups.map((g) => (
              <section key={g.month} className={styles.month}>
                <MonthHeader
                  title={formatMonth(g.month)}
                  total={g.total ? formatMoney(g.total) : undefined}
                />
                <ListGroup>
                  {g.records.map((r) => (
                    <SwipeRow
                      key={r.id}
                      left={{
                        label: 'Повторить',
                        icon: <IconRepeat />,
                        tone: 'accent',
                        onAction: () => void repeat(r.id),
                      }}
                      right={{
                        label: 'Удалить',
                        icon: <IconTrash />,
                        tone: 'danger',
                        onAction: () => remove(r),
                      }}
                    >
                      <RecordRow
                        {...recordRowProps(r, lookup, {
                          attachments: counts?.get(r.id),
                          onClick: () => void navigate(`/record/${r.id}`),
                        })}
                      />
                    </SwipeRow>
                  ))}
                </ListGroup>
              </section>
            ))}
          </div>
        )}
      </PullToRefresh>

      <JournalFilters
        key={sheetKey}
        open={sheetOpen}
        filter={filter}
        today={today}
        onApply={(f) => {
          setSheetOpen(false)
          apply(f)
        }}
        onClose={() => setSheetOpen(false)}
      />
      <AddRecordSheet open={adding} onClose={() => setAdding(false)} />
    </>
  )
}

/** Журнал активной машины: поиск, чипы видов, фильтры, месяцы с итогами, свайпы «Удалить» / «Повторить». */
export default function JournalPage() {
  return (
    <Page title="Журнал" large>
      <VehicleGate>{(v) => <Journal key={v.id} vehicle={v} />}</VehicleGate>
    </Page>
  )
}
