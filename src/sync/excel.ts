import { withBuiltinDefaults } from '../domain/catalog'
import {
  DRIVE_LABELS,
  EXPENSE_CATEGORY_LABELS,
  FUEL_TYPE_LABELS,
  TRANSMISSION_LABELS,
} from '../domain/labels'
import type { Snapshot } from '../domain/snapshot'
import type { CarRecord, ID, PartUnit, RecordKind, Row, ServiceRecord } from '../domain/types'

/**
 * Выгрузка в Excel: по листу на тип данных, только живые строки, суммы — в рублях числами,
 * даты — строками ГГГГ-ММ-ДД. SheetJS грузится лениво — он нужен только здесь.
 */

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

type Cell = string | number | null
type Sheet = { name: string; header: string[]; rows: Cell[][] }

const KIND: Record<RecordKind, string> = {
  service: 'ТО и ремонт',
  fuel: 'Заправка',
  expense: 'Расход',
  odometer: 'Пробег',
  note: 'Заметка',
}
const UNIT: Record<PartUnit, string> = { pcs: 'шт', l: 'л', set: 'компл', m: 'м', kg: 'кг' }

const rub = (kopecks: number | undefined): number | null => (kopecks === undefined ? null : kopecks / 100)
const yesNo = (v: boolean): string => (v ? 'Да' : 'Нет')
const live = <T extends Row>(rows: T[]): T[] => rows.filter((r) => !r.deleted)
const v = <T>(x: T | undefined): T | null => (x === undefined ? null : x)

function recordTitle(r: CarRecord): string | null {
  switch (r.kind) {
    case 'service':
    case 'note':
      return r.title
    case 'expense':
      return r.title ?? EXPENSE_CATEGORY_LABELS[r.category]
    case 'fuel':
      return r.fuelGrade ?? null
    case 'odometer':
      return null
  }
}

export function buildSheets(snapshot: Snapshot): Sheet[] {
  const t = snapshot.tables
  const names = <T extends Row & { name: string }>(rows: T[]) =>
    new Map<ID, string>(rows.map((r) => [r.id, r.name]))
  const vehicle = names(t.vehicles)
  const place = names(t.places)
  const master = names(t.masters)
  const item = names(t.catalogItems.map(withBuiltinDefaults))
  const nameOf = (map: Map<ID, string>, id: ID | undefined) => (id ? (map.get(id) ?? null) : null)

  const vehicles = [...live(t.vehicles)].sort((a, b) => a.order - b.order)
  // Строки удалённой машины не выгружаем, даже если сами они не помечены удалёнными.
  const liveVehicle = new Set(vehicles.map((x) => x.id))
  const records = live(t.records)
    .filter((r) => liveVehicle.has(r.vehicleId))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const services = records.filter((r): r is ServiceRecord => r.kind === 'service')

  return [
    {
      name: 'Машины',
      header: [
        'Название',
        'Марка',
        'Модель',
        'Поколение',
        'Год',
        'VIN',
        'Госномер',
        'Цвет',
        'Топливо',
        'Коробка',
        'Привод',
        'Дата покупки',
        'Пробег при покупке',
        'Цена покупки, ₽',
        'В архиве',
        'Заметка',
      ],
      rows: vehicles.map((x) => [
        x.name,
        x.make,
        x.model,
        v(x.generation),
        v(x.year),
        v(x.vin),
        v(x.plate),
        v(x.color),
        x.engine?.fuel ? FUEL_TYPE_LABELS[x.engine.fuel] : null,
        x.transmission ? TRANSMISSION_LABELS[x.transmission] : null,
        x.drive ? DRIVE_LABELS[x.drive] : null,
        v(x.purchase?.date),
        v(x.purchase?.odometer),
        rub(x.purchase?.price),
        yesNo(x.archived),
        v(x.note),
      ]),
    },
    {
      name: 'Журнал',
      header: ['Машина', 'Дата', 'Тип', 'Название', 'Пробег', 'Сумма, ₽', 'Место', 'Заметка'],
      rows: records.map((r) => [
        nameOf(vehicle, r.vehicleId),
        r.date,
        KIND[r.kind],
        recordTitle(r),
        v(r.odometer),
        rub(r.total),
        nameOf(place, r.placeId),
        v(r.note),
      ]),
    },
    {
      name: 'Запчасти',
      header: [
        'Машина',
        'Дата',
        'Пробег',
        'Узел',
        'Название',
        'Бренд',
        'Артикул',
        'Кол-во',
        'Ед.',
        'Цена, ₽',
        'Своя',
      ],
      rows: services.flatMap((r) =>
        r.parts.map((p) => [
          nameOf(vehicle, r.vehicleId),
          r.date,
          v(r.odometer),
          nameOf(item, p.itemId),
          p.name,
          v(p.brand),
          v(p.partNumber),
          p.qty,
          UNIT[p.unit],
          rub(p.unitPrice),
          yesNo(p.ownPart),
        ]),
      ),
    },
    {
      name: 'Работы',
      header: ['Машина', 'Дата', 'Пробег', 'Узел', 'Название', 'Цена, ₽', 'Мастер'],
      rows: services.flatMap((r) =>
        r.works.map((w) => [
          nameOf(vehicle, r.vehicleId),
          r.date,
          v(r.odometer),
          nameOf(item, w.itemId),
          w.name,
          rub(w.price),
          nameOf(master, w.masterId ?? r.masterId),
        ]),
      ),
    },
    {
      name: 'Заправки',
      header: [
        'Машина',
        'Дата',
        'Пробег',
        'Литры',
        'Цена за литр, ₽',
        'Сумма, ₽',
        'Полный бак',
        'Марка',
        'АЗС',
      ],
      rows: records.flatMap((r) =>
        r.kind === 'fuel'
          ? [
              [
                nameOf(vehicle, r.vehicleId),
                r.date,
                v(r.odometer),
                r.liters,
                rub(r.pricePerLiter),
                rub(r.total),
                yesNo(r.fullTank),
                v(r.fuelGrade),
                nameOf(place, r.placeId),
              ],
            ]
          : [],
      ),
    },
    {
      name: 'Расходы',
      header: ['Машина', 'Дата', 'Категория', 'Название', 'Сумма, ₽', 'Действует до'],
      rows: records.flatMap((r) =>
        r.kind === 'expense'
          ? [
              [
                nameOf(vehicle, r.vehicleId),
                r.date,
                EXPENSE_CATEGORY_LABELS[r.category],
                v(r.title),
                rub(r.total),
                v(r.validUntil),
              ],
            ]
          : [],
      ),
    },
    {
      name: 'Напоминания',
      header: ['Машина', 'Название', 'Интервал км', 'Интервал мес.'],
      rows: live(t.reminderRules)
        .filter((r) => liveVehicle.has(r.vehicleId))
        .map((r) => [
          nameOf(vehicle, r.vehicleId),
          r.title ?? nameOf(item, r.itemId),
          v(r.intervalKm),
          v(r.intervalMonths),
        ]),
    },
  ]
}

export async function buildWorkbook(snapshot: Snapshot): Promise<Blob> {
  const XLSX = await import('xlsx')
  const book = XLSX.utils.book_new()
  for (const sheet of buildSheets(snapshot)) {
    const ws = XLSX.utils.aoa_to_sheet([sheet.header, ...sheet.rows])
    ws['!cols'] = sheet.header.map((h) => ({ wch: Math.max(10, h.length + 2) }))
    XLSX.utils.book_append_sheet(book, ws, sheet.name)
  }
  const data = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([data], { type: XLSX_MIME })
}
