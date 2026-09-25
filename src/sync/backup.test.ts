import { afterEach, beforeEach, expect, test } from 'vitest'
import * as XLSX from 'xlsx'
import { MyAutoDB } from '../db/schema'
import { createRepos } from '../db/repos'
import { subscribeLocalChanges } from '../db/changes'
import { ensureSeed } from '../db/seed'
import { EXPENSE_CATEGORY_LABELS } from '../domain/labels'
import type { Snapshot } from '../domain/snapshot'
import type { ExpenseCategory } from '../domain/types'
import { createBackupService } from './backup'
import { GARAGE_PATH, createSyncEngine } from './engine'
import { FakeDisk } from './yandex/fakeDisk'
import { backupFileName } from './saveFile'

let db: MyAutoDB
beforeEach(() => {
  db = new MyAutoDB(`t-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await db.delete()
})

const asFile = async (b: Blob, name = 'backup.json') =>
  new File([await b.text()], name, { type: 'application/json' })

test('выгрузка → предпросмотр → замена', async () => {
  const repos = createRepos(db)
  await repos.places.create({ kind: 'service', name: 'СТО' })
  const svc = createBackupService({ db })
  const file = await asFile(await svc.exportJson())
  const preview = await svc.previewImport(file)
  expect(preview.counts.places).toBe(1)
  expect(preview.counts.records).toBe(0)
  await repos.places.create({ kind: 'fuel', name: 'АЗС' })
  await svc.importJson(file, 'replace')
  expect((await db.places.toArray()).filter((p) => !p.deleted).map((p) => p.name)).toEqual(['СТО'])
})

test('«Заменить всё» переживает синхронизацию: остаются ровно живые строки файла', async () => {
  const repos = createRepos(db)
  const sto = await repos.places.create({ kind: 'service', name: 'СТО' })
  const svc = createBackupService({ db })
  const file = await asFile(await svc.exportJson())
  // После выгрузки: СТО переименовано, добавлена АЗС, досеян встроенный каталог — всё это уже на Диске.
  await repos.places.update(sto.id, { name: 'СТО после бэкапа' })
  await repos.places.create({ kind: 'fuel', name: 'АЗС' })
  await ensureSeed(db, [
    { id: 'builtin-oil', name: 'Моторное масло', group: 'fluids', builtin: true, createdAt: 0, updatedAt: 0 },
  ])
  const disk = new FakeDisk()
  const engine = createSyncEngine({
    db,
    getDisk: () => disk,
    today: () => '2026-09-25',
    isOnline: () => true,
  })
  await engine.syncNow()

  await svc.importJson(file, 'replace')
  await engine.syncNow()

  const liveNames = (rows: { name: string; deleted?: boolean }[]) =>
    rows
      .filter((r) => !r.deleted)
      .map((r) => r.name)
      .sort()
  expect(liveNames(await db.places.toArray())).toEqual(['СТО'])
  expect(liveNames(disk.peekJson<Snapshot>(GARAGE_PATH)!.tables.places)).toEqual(['СТО'])
  expect((await db.catalogItems.get('builtin-oil'))?.deleted).toBeFalsy()
})

test('объединение не затирает более новые локальные правки и запускает синхронизацию', async () => {
  const repos = createRepos(db)
  const p = await repos.places.create({ kind: 'service', name: 'Старое имя' })
  const svc = createBackupService({ db })
  const oldFile = await asFile(await svc.exportJson())
  await repos.places.update(p.id, { name: 'Новое имя' })
  const seen: string[] = []
  const off = subscribeLocalChanges((t) => seen.push(t))
  await svc.importJson(oldFile, 'merge')
  off()
  expect((await db.places.get(p.id))?.name).toBe('Новое имя')
  expect(seen.length).toBeGreaterThan(0)
})

test('чужой файл — понятная ошибка', async () => {
  const svc = createBackupService({ db })
  await expect(svc.previewImport(new File(['{"x":1}'], 'x.json'))).rejects.toThrow('Это не файл «Мой авто»')
  await expect(svc.previewImport(new File(['не json'], 'x.json'))).rejects.toThrow('Это не файл «Мой авто»')
})

test('Excel: листы и строка запчасти', async () => {
  const repos = createRepos(db)
  const v = await repos.vehicles.create({
    name: 'Октавия',
    make: 'Skoda',
    model: 'Octavia',
    archived: false,
    fluids: [],
    order: 0,
  })
  await repos.records.create({
    vehicleId: v.id,
    kind: 'service',
    date: '2026-09-12',
    odometer: 145100,
    total: 1245000,
    title: 'ТО-15',
    serviceType: 'maintenance',
    diy: false,
    works: [],
    parts: [
      {
        id: 'p',
        name: 'Масляный фильтр',
        brand: 'Mann-Filter',
        partNumber: 'W 712/95',
        qty: 1,
        unit: 'pcs',
        unitPrice: 65000,
        ownPart: true,
      },
    ],
  })
  const blob = await createBackupService({ db }).exportExcel()
  const wb = XLSX.read(await blob.arrayBuffer())
  expect(wb.SheetNames).toEqual([
    'Машины',
    'Журнал',
    'Запчасти',
    'Работы',
    'Заправки',
    'Расходы',
    'Напоминания',
  ])
  const parts = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Запчасти']!)
  expect(parts[0]).toMatchObject({
    Машина: 'Октавия',
    Дата: '2026-09-12',
    Бренд: 'Mann-Filter',
    Артикул: 'W 712/95',
    'Цена, ₽': 650,
  })
})

test('Excel: только живые строки, заправка и журнал в рублях', async () => {
  const repos = createRepos(db)
  const v = await repos.vehicles.create({
    name: 'Октавия',
    make: 'Skoda',
    model: 'Octavia',
    archived: false,
    fluids: [],
    order: 0,
  })
  const azs = await repos.places.create({ kind: 'fuel', name: 'Лукойл' })
  await repos.records.create({
    vehicleId: v.id,
    kind: 'fuel',
    date: '2026-09-20',
    odometer: 145400,
    total: 280050,
    liters: 45,
    pricePerLiter: 6223,
    fullTank: true,
    missedBefore: false,
    fuelGrade: 'АИ-95',
    placeId: azs.id,
  })
  const wash = await repos.records.create({
    vehicleId: v.id,
    kind: 'expense',
    date: '2026-09-21',
    total: 50000,
    category: 'wash',
  })
  await repos.records.remove(wash.id)
  const wb = XLSX.read(await (await createBackupService({ db }).exportExcel()).arrayBuffer())
  const rows = (sheet: string) => XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet]!)
  expect(rows('Расходы')).toEqual([])
  expect(rows('Журнал')).toHaveLength(1)
  expect(rows('Журнал')[0]).toMatchObject({
    Машина: 'Октавия',
    Дата: '2026-09-20',
    Тип: 'Заправка',
    Пробег: 145400,
    'Сумма, ₽': 2800.5,
    Место: 'Лукойл',
  })
  expect(rows('Заправки')[0]).toMatchObject({
    Литры: 45,
    'Цена за литр, ₽': 62.23,
    'Сумма, ₽': 2800.5,
    'Полный бак': 'Да',
    Марка: 'АИ-95',
    АЗС: 'Лукойл',
  })
})

test('Excel: записи и напоминания удалённой машины не выгружаются', async () => {
  const repos = createRepos(db)
  const sold = await repos.vehicles.create({
    name: 'Старая',
    make: 'Lada',
    model: '2107',
    archived: false,
    fluids: [],
    order: 0,
  })
  await repos.records.create({
    vehicleId: sold.id,
    kind: 'expense',
    date: '2026-09-01',
    total: 10000,
    category: 'wash',
  })
  await repos.reminders.create({ vehicleId: sold.id, title: 'Масло', intervalKm: 10000, enabled: true })
  await repos.vehicles.remove(sold.id)
  const wb = XLSX.read(await (await createBackupService({ db }).exportExcel()).arrayBuffer())
  const rows = (sheet: string) => XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet]!)
  expect(rows('Машины')).toEqual([])
  expect(rows('Журнал')).toEqual([])
  expect(rows('Расходы')).toEqual([])
  expect(rows('Напоминания')).toEqual([])
})

test('Excel: категории расходов подписаны как в приложении (domain/labels)', async () => {
  const repos = createRepos(db)
  const v = await repos.vehicles.create({
    name: 'Октавия',
    make: 'Skoda',
    model: 'Octavia',
    archived: false,
    fluids: [],
    order: 0,
  })
  const categories = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]
  for (const category of categories) {
    await repos.records.create({
      vehicleId: v.id,
      kind: 'expense',
      date: '2026-09-01',
      total: 10000,
      category,
    })
  }
  const wb = XLSX.read(await (await createBackupService({ db }).exportExcel()).arrayBuffer())
  const rows = (sheet: string) => XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheet]!)
  const expected = categories.map((c) => EXPENSE_CATEGORY_LABELS[c]).sort()
  expect(
    rows('Расходы')
      .map((r) => r['Категория'])
      .sort(),
  ).toEqual(expected)
  // Расход без названия в журнале называется своей категорией.
  expect(
    rows('Журнал')
      .map((r) => r['Название'])
      .sort(),
  ).toEqual(expected)
})

test('имя файла бэкапа', () => {
  expect(backupFileName('json', '2026-09-25')).toBe('moy-avto-2026-09-25.json')
})
