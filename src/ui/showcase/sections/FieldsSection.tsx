import { useState } from 'react'
import {
  Checkbox,
  Combobox,
  DateField,
  MoneyField,
  NumberField,
  OdometerField,
  Rating,
  SearchField,
  Select,
  Switch,
  TextArea,
  TextField,
  type ComboboxOption,
} from '../../index'
import { Demo, fmt, Section, Stack } from '../kit'

const PLACES: ComboboxOption[] = [
  { id: 'p1', label: 'Автосервис на Ленина', hint: 'ул. Ленина, 14 · 6 визитов' },
  { id: 'p2', label: 'Автосервис «Колесо»', hint: 'Профсоюзная, 128' },
  { id: 'p3', label: 'Официальный дилер Skoda', hint: 'МКАД, 41 км' },
  { id: 'p4', label: 'Шиномонтаж у дома' },
]

export function FieldsSection() {
  const [name, setName] = useState('ТО-6')
  const [liters, setLiters] = useState<number | undefined>(42.5)
  const [money, setMoney] = useState<number | undefined>(185000)
  const [date, setDate] = useState('2026-09-24')
  const [odo, setOdo] = useState<number | undefined>(148100)
  const [fuel, setFuel] = useState<'ai92' | 'ai95' | 'ai98' | 'dt' | undefined>('ai95')
  const [place, setPlace] = useState<ComboboxOption | null>(null)
  const [query, setQuery] = useState('')
  const [full, setFull] = useState(true)
  const [self, setSelf] = useState(false)
  const [warranty, setWarranty] = useState(true)
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | undefined>(4)
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')

  const q = query.trim().toLowerCase()
  const options = q ? PLACES.filter((p) => p.label.toLowerCase().includes(q)) : PLACES

  return (
    <Section title="Поля" lead="Подпись над полем, подсказка и ошибка под ним; суммы понимают арифметику.">
      <Demo name="TextField и TextArea">
        <TextField
          label="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="Подсказки: ТО-N и прошлые"
        />
        <TextField label="VIN" defaultValue="XW8ZZZ1ZKG12345" error="17 символов, без I, O и Q" />
        <TextArea
          label="Заметка"
          placeholder="Что сделали, что заметили"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Demo>

      <Demo name="MoneyField" note="«1200+650» — появится итог. Клавиша «+» — для цифровой клавиатуры iPhone, фокус остаётся в поле; «+500» прибавляет рубли.">
        <MoneyField label="Сумма" value={money} onChange={setMoney} quickAdd={[500, 1000, 5000]} />
        <MoneyField
          label="Сумма с ошибкой"
          value={undefined}
          onChange={() => {}}
          error="Не получилось посчитать сумму"
        />
      </Demo>

      <Demo name="NumberField, OdometerField, DateField">
        <NumberField label="Литры" unit="л" decimals={2} value={liters} onChange={setLiters} />
        <OdometerField
          value={odo}
          onChange={setOdo}
          lastKnown={`последний: ${fmt.km(148320)}`}
          warning={odo !== undefined && odo < 148320 ? 'Меньше, чем в записи от 12.09.2026' : undefined}
        />
        <DateField label="Дата" value={date} onChange={setDate} today="2026-09-25" quick max="2026-09-25" />
      </Demo>

      <Demo name="Select и Combobox" note="В комбобоксе — подсказки и «Создать «…»».">
        <Select
          label="Топливо"
          value={fuel}
          onChange={setFuel}
          options={[
            { value: 'ai92', label: 'АИ-92' },
            { value: 'ai95', label: 'АИ-95' },
            { value: 'ai98', label: 'АИ-98' },
            { value: 'dt', label: 'Дизель' },
          ]}
        />
        <Combobox
          label="Место"
          placeholder="Автосервис, АЗС, магазин"
          value={place}
          options={options}
          query={query}
          onQueryChange={setQuery}
          onSelect={setPlace}
          onCreate={(label) => {
            const created = { id: `new-${label}`, label }
            setPlace(created)
            setQuery(label)
          }}
        />
      </Demo>

      <Demo name="Switch, Checkbox, Rating" plain>
        <div
          style={{ borderRadius: 'var(--radius-lg)', background: 'var(--color-surface)', overflow: 'hidden' }}
        >
          <Switch label="Полный бак" checked={full} onChange={setFull} />
          <Switch
            label="Гарантия"
            hint={`До 25.09.2027 или ${fmt.km(30000)}`}
            checked={warranty}
            onChange={setWarranty}
          />
        </div>
        <Stack gap={2}>
          <Checkbox label="Делал сам" checked={self} onChange={setSelf} />
          <Rating label="Оценка мастера" value={rating} onChange={setRating} />
          <Rating value={3} />
        </Stack>
      </Demo>

      <Demo name="SearchField" plain>
        <SearchField value={search} onChange={setSearch} />
      </Demo>
    </Section>
  )
}
