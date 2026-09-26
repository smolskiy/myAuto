import { describe, expect, test } from 'vitest'
import { hasServiceDetails } from './serviceDetails'
import { newRecordValues, type RecordFormValues } from './useRecordForm'

const blank = () => newRecordValues('service', { id: 'v1' }, { today: '2026-09-26', currentOdometer: 148000 })
const values = (patch: Partial<RecordFormValues>): RecordFormValues => ({ ...blank(), ...patch })

describe('hasServiceDetails', () => {
  test('новое ТО без строк, мастера и гарантии — коротко', () => {
    expect(hasServiceDetails(blank())).toBe(false)
  })

  test('название, тип, стоимость, место, шины и заметка подробностями не считаются', () => {
    expect(
      hasServiceDetails(
        values({
          title: 'Переобувка',
          serviceType: 'tires',
          total: 250000,
          totalManual: true,
          placeId: 'p1',
          mountedSetId: 's1',
          removedSetId: 's2',
          note: 'Балансировка',
        }),
      ),
    ).toBe(false)
  })

  test.each<[string, Partial<RecordFormValues>]>([
    ['работа', { works: [{ id: 'w1', name: 'Замена масла' }] }],
    ['запчасть', { parts: [{ id: 'p1', name: 'Фильтр', qty: 1, unit: 'pcs', ownPart: false }] }],
    ['«Делал сам»', { diy: true }],
    ['мастер', { masterId: 'm1' }],
    ['гарантия до даты', { warrantyUntilDate: '2027-09-26' }],
    ['гарантия до пробега', { warrantyUntilKm: 180000 }],
    ['гарантия до пробега 0 км', { warrantyUntilKm: 0 }],
  ])('%s — подробно', (_, patch) => {
    expect(hasServiceDetails(values(patch))).toBe(true)
  })
})
