import { IconCopy } from '@tabler/icons-react'
import { useMemo, useRef, useState } from 'react'
import { useLastPart, useTireSets } from '../../../db/hooks'
import { lineTotal } from '../../../domain/calc/lines'
import { formatDate, formatMoney } from '../../../domain/format'
import type { ID, PartLine, ServiceType, TireSet, WorkLine } from '../../../domain/types'
import {
  Button,
  Combobox,
  DateField,
  LineItemRow,
  ListGroup,
  MoneyField,
  NumberField,
  RepeatableList,
  Select,
  Switch,
} from '../../../ui'
import { MasterPicker, PlacePicker, SERVICE_TYPE_LABELS, TIRE_SEASON_LABELS, useLookup } from '../../common'
import { lastPartText, partMeta } from '../lineText'
import { RecordDateField, RecordOdometerField, type FieldsProps } from './CommonFields'
import { PartSheet } from './PartSheet'
import { WorkSheet } from './WorkSheet'
import styles from './RecordForm.module.css'
import {
  applyLastPart,
  blankPart,
  blankWork,
  copyLines,
  isBlankLine,
  matchesLastPart,
  repeatSource,
  titleOptions,
  type PartDraft,
} from './serviceLines'
import { linesTotal } from './serviceTotals'
import { serviceTotal } from './useRecordForm'

const TYPE_OPTIONS = (Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((value) => ({
  value,
  label: SERVICE_TYPE_LABELS[value],
}))

const NO_SET = 'none'

const tireSetLabel = (s: TireSet) =>
  [TIRE_SEASON_LABELS[s.season], s.brand, s.model].filter(Boolean).join(' ') + (s.size ? `, ${s.size}` : '')

const normalize = (s: string) => s.trim().toLowerCase().replaceAll('ё', 'е')

/** Открытая шторка строки; `seq` растёт с каждым открытием — ключ шторки, чтобы черновик брался из строки заново. */
type Sheet<T> = { line: T; isNew: boolean; open: boolean; seq: number } | null

/** Строка запчасти в списке: без бренда и цены, но с узлом — подсказка «в прошлый раз» одним касанием. */
function PartRow({
  line,
  vehicleId,
  onEdit,
  onRemove,
  onApply,
}: {
  line: PartLine
  vehicleId: ID
  onEdit(): void
  onRemove(): void
  onApply(last: PartLine): void
}) {
  const bare = !line.brand && !line.partNumber && line.unitPrice === undefined
  const last = useLastPart(vehicleId, bare ? line.itemId : undefined)
  const text = last && !matchesLastPart(line, last.line) ? lastPartText(last.line) : null
  return (
    <LineItemRow
      title={line.name}
      meta={partMeta(line)}
      amount={line.unitPrice !== undefined ? formatMoney(lineTotal(line)) : undefined}
      onEdit={onEdit}
      onRemove={onRemove}
      suggestion={text && last ? { text, onApply: () => onApply(last.line) } : undefined}
    />
  )
}

/** ТО и ремонт: название, тип, место и мастер, строки работ и запчастей, итог, шины, гарантия. */
export function ServiceFields({ form, ctx, suggestDate }: FieldsProps & { suggestDate: boolean }) {
  const { values, errors, set, update } = form
  const lookup = useLookup()
  const tireSets = useTireSets(values.serviceType === 'tires' ? values.vehicleId : undefined)
  const [workSheet, setWorkSheet] = useState<Sheet<WorkLine>>(null)
  const [partSheet, setPartSheet] = useState<Sheet<PartDraft>>(null)
  const openSeq = useRef(0)
  const openWork = (line: WorkLine, isNew: boolean) =>
    setWorkSheet({ line, isNew, open: true, seq: ++openSeq.current })
  const openPart = (line: PartDraft, isNew: boolean) =>
    setPartSheet({ line, isNew, open: true, seq: ++openSeq.current })

  // ——— Название: «ТО-N» и прошлые ———
  const titles = useMemo(() => titleOptions(ctx.records, ctx.editingId), [ctx.records, ctx.editingId])
  const q = normalize(values.title)
  const titleList = titles
    .filter((t) => !q || normalize(t.title).includes(q))
    .map((t) => ({ id: t.title, label: t.title }))
  const titleValue = titleList.find((o) => o.label === values.title) ?? null

  // ——— Место и мастер ———
  const placeKinds =
    values.serviceType === 'tires' ? (['tire', 'service'] as const) : (['service', 'tire'] as const)
  const changePlace = (placeId?: ID) =>
    // Мастер прежнего места новому месту не принадлежит.
    set(placeId === values.placeId ? { placeId } : { placeId, masterId: undefined })
  const changeMaster = (masterId?: ID) => {
    const masterPlace = masterId ? lookup?.masters.get(masterId)?.placeId : undefined
    // Мастер выбран раньше места — место подставляется его.
    set(!values.placeId && masterPlace ? { masterId, placeId: masterPlace } : { masterId })
  }

  // ——— Повторить прошлое ТО ———
  const empty = values.works.length === 0 && values.parts.length === 0
  const source = empty ? repeatSource(ctx.records, values, ctx.editingId) : null
  const repeat = () => {
    if (!source) return
    update((v) => ({
      ...copyLines(source),
      ...(!v.placeId && source.placeId
        ? { placeId: source.placeId, masterId: source.masterId, diy: source.diy }
        : {}),
    }))
  }

  // ——— Строки ———
  const saveWork = (line: WorkLine) => {
    const sheet = workSheet
    setWorkSheet((s) => s && { ...s, open: false })
    if (!sheet || isBlankLine(line)) return
    update((v) => ({
      works: sheet.isNew ? [...v.works, line] : v.works.map((w) => (w.id === line.id ? line : w)),
    }))
  }
  const savePart = (line: PartLine) => {
    const sheet = partSheet
    setPartSheet((s) => s && { ...s, open: false })
    if (!sheet || isBlankLine(line)) return
    update((v) => ({
      parts: sheet.isNew ? [...v.parts, line] : v.parts.map((p) => (p.id === line.id ? line : p)),
    }))
  }
  const worksSum = linesTotal(values.works, [])
  const partsSum = linesTotal([], values.parts)

  // ——— Итог ———
  const byLines = linesTotal(values.works, values.parts)
  const total = values.totalManual ? values.total : serviceTotal(values) || undefined

  return (
    <>
      <Combobox
        label="Название"
        value={titleValue}
        options={titleList}
        query={values.title}
        onQueryChange={(title) => set({ title })}
        onSelect={(o) => {
          const t = o && titles.find((x) => x.title === o.label)
          if (t) set({ title: t.title, serviceType: t.serviceType })
        }}
        placeholder="ТО, замена колодок…"
        error={errors.title}
      />
      <Select
        label="Тип работ"
        value={values.serviceType}
        options={TYPE_OPTIONS}
        onChange={(serviceType) => set({ serviceType })}
      />
      <RecordDateField form={form} ctx={ctx} suggest={suggestDate} />
      <RecordOdometerField form={form} ctx={ctx} />
      <PlacePicker label="Место" kinds={[...placeKinds]} value={values.placeId} onChange={changePlace} />
      <ListGroup>
        <Switch
          label="Делал сам"
          checked={values.diy}
          onChange={(diy) => set(diy ? { diy, masterId: undefined } : { diy })}
        />
      </ListGroup>
      {!values.diy && (
        <MasterPicker placeId={values.placeId} value={values.masterId} onChange={changeMaster} />
      )}

      {source && (
        <div className={styles.stack}>
          <Button variant="secondary" block icon={<IconCopy />} onClick={repeat}>
            Повторить прошлое ТО
          </Button>
          <p className={styles.caption}>
            {`Строки из «${source.title || SERVICE_TYPE_LABELS[source.serviceType]}», ${formatDate(source.date)}`}
          </p>
        </div>
      )}

      <RepeatableList
        title="Работы"
        addLabel="Добавить работу"
        onAdd={() => openWork(blankWork(), true)}
        total={worksSum ? formatMoney(worksSum) : undefined}
      >
        {values.works.map((w) => (
          <LineItemRow
            key={w.id}
            title={w.name}
            meta={w.masterId ? lookup?.masters.get(w.masterId)?.name : undefined}
            amount={w.price !== undefined ? formatMoney(w.price) : undefined}
            onEdit={() => openWork(w, false)}
            onRemove={() => update((v) => ({ works: v.works.filter((x) => x.id !== w.id) }))}
          />
        ))}
      </RepeatableList>

      <RepeatableList
        title="Запчасти"
        addLabel="Добавить запчасть"
        onAdd={() => openPart(blankPart(values.diy), true)}
        total={partsSum ? formatMoney(partsSum) : undefined}
      >
        {values.parts.map((p) => (
          <PartRow
            key={p.id}
            line={p}
            vehicleId={values.vehicleId}
            onEdit={() => openPart(p, false)}
            onRemove={() => update((v) => ({ parts: v.parts.filter((x) => x.id !== p.id) }))}
            onApply={(last) =>
              update((v) => ({
                parts: v.parts.map((x) => (x.id === p.id ? { ...applyLastPart(x, last), qty: last.qty } : x)),
              }))
            }
          />
        ))}
      </RepeatableList>

      <div className={styles.stack}>
        <MoneyField
          label="Итого"
          value={total}
          onChange={(k) => set({ total: k, totalManual: true })}
          hint={
            values.totalManual
              ? `Итог по строкам: ${formatMoney(byLines)}`
              : 'Сумма строк; можно ввести вручную'
          }
        />
        {values.totalManual && (
          <div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => set({ totalManual: false, total: undefined })}
            >
              Считать по строкам
            </Button>
          </div>
        )}
      </div>

      {values.serviceType === 'tires' && (
        <>
          <Select
            label="Установлен комплект"
            value={values.mountedSetId ?? NO_SET}
            options={tireOptions(tireSets, values.mountedSetId)}
            onChange={(id) => set({ mountedSetId: id === NO_SET ? undefined : id })}
          />
          <Select
            label="Снят комплект"
            value={values.removedSetId ?? NO_SET}
            options={tireOptions(tireSets, values.removedSetId)}
            onChange={(id) => set({ removedSetId: id === NO_SET ? undefined : id })}
            error={errors.removedSetId}
          />
        </>
      )}

      <div className={styles.pair}>
        <DateField
          label="Гарантия до"
          value={values.warrantyUntilDate}
          onChange={(warrantyUntilDate) => set({ warrantyUntilDate })}
          today={ctx.today}
        />
        <NumberField
          label="Гарантия до пробега"
          value={values.warrantyUntilKm}
          onChange={(warrantyUntilKm) => set({ warrantyUntilKm })}
          unit="км"
          decimals={0}
          min={0}
        />
      </div>

      {workSheet && (
        <WorkSheet
          key={workSheet.seq}
          open={workSheet.open}
          line={workSheet.line}
          placeId={values.placeId}
          diy={values.diy}
          onDone={saveWork}
        />
      )}
      {partSheet && (
        <PartSheet
          key={partSheet.seq}
          open={partSheet.open}
          line={partSheet.line}
          vehicleId={values.vehicleId}
          onDone={savePart}
        />
      )}
    </>
  )
}

function tireOptions(sets: TireSet[] | undefined, selected?: ID) {
  const list = (sets ?? []).filter((s) => s.status !== 'retired' || s.id === selected)
  return [{ value: NO_SET, label: 'Нет' }, ...list.map((s) => ({ value: s.id, label: tireSetLabel(s) }))]
}
