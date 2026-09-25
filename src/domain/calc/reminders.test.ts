import { describe, expect, test } from 'vitest'
import { BUILTIN_CATALOG, CATALOG_ID } from '../catalog'
import { documentDeadlines, evaluateReminder, evaluateReminders, upcoming } from './reminders'
import { expense, odo, service } from './fixtures'
import type { ReminderRule, VehicleDocument } from '../types'

const TODAY = '2026-09-25'
const rule = (p: Partial<ReminderRule>): ReminderRule => ({
  id: 'rule1',
  createdAt: 1,
  updatedAt: 1,
  vehicleId: 'v1',
  enabled: true,
  itemId: CATALOG_ID.engineOil,
  intervalKm: 10000,
  intervalMonths: 12,
  ...p,
})
const oilChange = (id: string, date: string, odometer: number) =>
  service({
    id,
    date,
    odometer,
    parts: [{ id: `${id}p`, itemId: CATALOG_ID.engineOil, name: 'Масло', qty: 4, unit: 'l', ownPart: true }],
  })
const ctx = (
  records: ReturnType<typeof service>[] | unknown[],
  currentOdometer: number | null,
  avgDailyKm: number | null = 50,
) => ({
  records: records as never,
  catalog: BUILTIN_CATALOG,
  today: TODAY,
  currentOdometer,
  avgDailyKm,
})

describe('напоминание по узлу', () => {
  test('в порядке: остаток 1200 км из 10000, 112 дней', () => {
    const s = evaluateReminder(rule({}), ctx([oilChange('s1', '2026-01-15', 140000)], 148800))
    expect(s).toMatchObject({
      state: 'ok',
      title: 'Моторное масло',
      dueKm: 150000,
      remainingKm: 1200,
      dueDate: '2027-01-15',
      remainingDays: 112,
      predictedDate: '2026-10-19',
      last: { date: '2026-01-15', odometer: 140000, recordId: 's1', source: 'record' },
    })
    expect(s.progressKm).toBeCloseTo(0.88, 5)
  })

  test('скоро по км: остаток ≤ max(1000 км, 10 %)', () => {
    expect(evaluateReminder(rule({}), ctx([oilChange('s1', '2026-01-15', 140000)], 149200)).state).toBe(
      'soon',
    )
  })

  test('просрочено по времени', () => {
    const s = evaluateReminder(rule({}), ctx([oilChange('s1', '2025-09-01', 140000)], 141000))
    expect(s.state).toBe('overdue')
    expect(s.remainingDays).toBe(-24)
  })

  test('берётся самая поздняя замена, удалённые игнорируются', () => {
    const recs = [
      oilChange('old', '2025-06-01', 130000),
      oilChange('new', '2026-06-01', 145000),
      { ...oilChange('del', '2026-08-01', 147000), deleted: true },
    ]
    expect(evaluateReminder(rule({}), ctx(recs, 146000)).last?.recordId).toBe('new')
  })

  test('последняя замена без пробега: км — от последней записи с пробегом, время — от последней даты', () => {
    const noOdo = { ...oilChange('s2', '2026-06-01', 0), odometer: undefined }
    const s = evaluateReminder(rule({}), ctx([oilChange('s1', '2026-01-15', 140000), noOdo], 148800))
    expect(s).toMatchObject({
      dueKm: 150000,
      remainingKm: 1200,
      dueDate: '2027-06-01',
      last: { date: '2026-06-01', recordId: 's2' },
    })
    expect(s.last?.odometer).toBeUndefined()
  })

  test('без записей — точка отсчёта, без неё — unknown', () => {
    const withBaseline = evaluateReminder(
      rule({ baseline: { date: '2026-01-01', odometer: 139000 } }),
      ctx([], 148000),
    )
    expect(withBaseline).toMatchObject({
      dueKm: 149000,
      remainingKm: 1000,
      state: 'soon',
      last: { source: 'baseline' },
    })
    expect(evaluateReminder(rule({}), ctx([odo({ date: '2026-01-01', odometer: 1 })], 1)).state).toBe(
      'unknown',
    )
  })

  test('без среднего пробега прогноз даты — только по времени', () => {
    const s = evaluateReminder(rule({}), ctx([oilChange('s1', '2026-01-15', 140000)], 148800, null))
    expect(s.predictedDate).toBe('2027-01-15')
  })

  test('разовое напоминание к дате и своё название', () => {
    const s = evaluateReminder(
      rule({
        itemId: undefined,
        intervalKm: undefined,
        intervalMonths: undefined,
        title: 'Пройти техосмотр',
        dueDate: '2026-10-10',
      }),
      ctx([], 148000),
    )
    expect(s).toMatchObject({
      title: 'Пройти техосмотр',
      state: 'soon',
      remainingDays: 15,
      dueDate: '2026-10-10',
    })
  })

  test('выключенные правила не попадают в список', () => {
    expect(
      evaluateReminders([rule({ enabled: false }), rule({ id: 'r2', deleted: true })], ctx([], 1)),
    ).toEqual([])
  })
})

describe('сроки документов', () => {
  const doc = (p: Partial<VehicleDocument>): VehicleDocument => ({
    id: 'd1',
    createdAt: 1,
    updatedAt: 1,
    vehicleId: 'v1',
    kind: 'osago',
    ...p,
  })

  test('ОСАГО истекает через 12 дней — скоро', () => {
    const [d] = documentDeadlines([doc({ validUntil: '2026-10-07' })], [], TODAY)
    expect(d).toMatchObject({
      kind: 'osago',
      title: 'ОСАГО',
      remainingDays: 12,
      state: 'soon',
      source: { type: 'document', id: 'd1' },
    })
  })

  test('полис из расхода и документ — один вид, берётся самая поздняя дата', () => {
    const ds = documentDeadlines(
      [doc({ validUntil: '2026-10-07' })],
      [expense({ id: 'e1', category: 'osago', validUntil: '2027-10-06', date: '2026-10-01' })],
      TODAY,
    )
    expect(ds).toHaveLength(1)
    expect(ds[0]).toMatchObject({
      validUntil: '2027-10-06',
      state: 'ok',
      source: { type: 'expense', id: 'e1' },
    })
  })

  test('в последний день действия — ещё скоро, на следующий — просрочено', () => {
    expect(documentDeadlines([doc({ validUntil: TODAY })], [], TODAY)[0]).toMatchObject({
      remainingDays: 0,
      state: 'soon',
    })
    expect(documentDeadlines([doc({ validUntil: '2026-09-24' })], [], TODAY)[0]).toMatchObject({
      remainingDays: -1,
      state: 'overdue',
    })
  })

  test('техосмотр из расхода — диагностическая карта; прочие документы не сливаются', () => {
    const ds = documentDeadlines(
      [
        doc({ id: 'o1', kind: 'other', title: 'Пропуск', validUntil: '2027-01-01' }),
        doc({ id: 'o2', kind: 'other', validUntil: '2027-02-01' }),
      ],
      [expense({ id: 'e2', category: 'inspection', validUntil: '2027-03-01' })],
      TODAY,
    )
    expect(ds.map((d) => [d.kind, d.title])).toEqual([
      ['other', 'Пропуск'],
      ['other', 'Документ'],
      ['diagCard', 'Диагностическая карта'],
    ])
  })

  test('без срока действия — не попадает', () => {
    expect(documentDeadlines([doc({ kind: 'sts' })], [], TODAY)).toEqual([])
  })
})

test('общий список «Скоро»: сначала просроченные, потом ближайшие', () => {
  const reminders = [
    evaluateReminder(rule({ id: 'ok' }), ctx([oilChange('s1', '2026-01-15', 140000)], 148800)),
    evaluateReminder(rule({ id: 'late' }), ctx([oilChange('s2', '2025-09-01', 140000)], 141000)),
  ]
  const deadlines = documentDeadlines(
    [{ id: 'd1', createdAt: 1, updatedAt: 1, vehicleId: 'v1', kind: 'osago', validUntil: '2026-10-07' }],
    [],
    TODAY,
  )
  expect(upcoming(reminders, deadlines, 3).map((u) => u.key)).toEqual([
    'reminder:late',
    'deadline:osago:v1',
    'reminder:ok',
  ])
})
