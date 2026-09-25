import { expect, test } from 'vitest'
import type { ReminderStatus } from '../../domain/calc/reminders'
import { BUILTIN_CATALOG, CATALOG_ID as C } from '../../domain/catalog'
import type { CatalogItem, Vehicle } from '../../domain/types'
import { autoSchematic, schematicData, schematicModelFor, zoneOfItem } from './schematic'

const car = (make: string, model: string, extra: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1',
  createdAt: 1,
  updatedAt: 1,
  name: 'Машина',
  make,
  model,
  archived: false,
  fluids: [],
  order: 0,
  ...extra,
})

test('Октавия A5 — по марке, модели и году, по-русски и по-английски', () => {
  expect(schematicModelFor(car('Skoda', 'Octavia', { year: 2011 }))).toBe('octavia-a5')
  expect(schematicModelFor(car('Шкода', 'Октавия'))).toBe('octavia-a5')
  expect(schematicModelFor(car('ŠKODA', 'Octavia RS', { year: 2012 }))).toBe('octavia-a5')
})

test('другая Октавия — без схемы: другое поколение, универсал, Tour', () => {
  expect(schematicModelFor(car('Skoda', 'Octavia', { year: 2015 }))).toBeNull()
  expect(schematicModelFor(car('Skoda', 'Octavia', { year: 2011, bodyType: 'Универсал' }))).toBeNull()
  expect(schematicModelFor(car('Skoda', 'Octavia Combi', { year: 2011 }))).toBeNull()
  expect(schematicModelFor(car('Skoda', 'Octavia Tour', { year: 2008 }))).toBeNull()
})

test('cee’d первого поколения — универсал, пока кузов не указан другой', () => {
  expect(schematicModelFor(car('Kia', "cee'd", { year: 2008 }))).toBe('ceed-sw-1')
  expect(schematicModelFor(car('KIA', 'Ceed SW'))).toBe('ceed-sw-1')
  expect(schematicModelFor(car('Киа', 'Сид', { year: 2007 }))).toBe('ceed-sw-1')
  expect(schematicModelFor(car('Kia', 'cee’d', { year: 2010, bodyType: 'Station Wagon' }))).toBe('ceed-sw-1')
})

test('другой cee’d — без схемы: хэтчбек, pro_cee’d, XCeed, новое поколение', () => {
  expect(schematicModelFor(car('Kia', "cee'd", { year: 2008, bodyType: 'Хэтчбек' }))).toBeNull()
  expect(schematicModelFor(car('Kia', "pro_cee'd", { year: 2009 }))).toBeNull()
  expect(schematicModelFor(car('Kia', 'XCeed', { year: 2020 }))).toBeNull()
  expect(schematicModelFor(car('Kia', 'Ceed', { year: 2019 }))).toBeNull()
  expect(schematicModelFor(car('Lada', '2109', { year: 2000 }))).toBeNull()
})

test('исключения понимают кириллицу: «Про Сид», «ИксСид», «Хэтчбэк», «А7»', () => {
  expect(schematicModelFor(car('Киа', 'Про Сид'))).toBeNull()
  expect(schematicModelFor(car('Kia', 'ИксСид'))).toBeNull()
  expect(schematicModelFor(car('Kia', 'Сид', { bodyType: 'Хэтчбэк' }))).toBeNull()
  expect(schematicModelFor(car('Шкода', 'Октавия А7'))).toBeNull()
  expect(schematicModelFor(car('Skoda', 'Octavia', { generation: 'A7' }))).toBeNull()
  expect(schematicModelFor(car('Skoda', 'Octavia', { generation: 'А5 рестайлинг' }))).toBe('octavia-a5')
})

test('Lanos (Daewoo, Chevrolet, ЗАЗ Sens/Chance) и BMW X5 F15 — свои чертежи', () => {
  expect(schematicModelFor(car('Daewoo', 'Lanos'))).toBe('lanos')
  expect(schematicModelFor(car('Chevrolet', 'Ланос', { year: 2008 }))).toBe('lanos')
  expect(schematicModelFor(car('ЗАЗ', 'Шанс'))).toBe('lanos')
  expect(schematicModelFor(car('ZAZ', 'Sens'))).toBe('lanos')
  expect(schematicModelFor(car('BMW', 'X5', { year: 2016 }))).toBe('x5-f15')
  expect(schematicModelFor(car('БМВ', 'Х5'))).toBe('x5-f15')
  expect(schematicModelFor(car('BMW', 'X5 xDrive30d', { year: 2015 }))).toBe('x5-f15')
  expect(schematicModelFor(car('BMW', 'X5', { year: 2008 }))).toBeNull()
  expect(schematicModelFor(car('BMW', 'X5', { generation: 'G05' }))).toBeNull()
  expect(schematicModelFor(car('BMW', 'X3', { year: 2016 }))).toBeNull()
})

test('выбор владельца важнее подбора: другой чертёж или «без чертежа»', () => {
  expect(schematicModelFor(car('Lada', '2109', { schematic: 'lanos' }))).toBe('lanos')
  expect(schematicModelFor(car('Skoda', 'Octavia', { year: 2011, schematic: 'none' }))).toBeNull()
  // Неизвестный id (чертёж убрали из новой версии) — как «автоматически».
  expect(schematicModelFor(car('Skoda', 'Octavia', { year: 2011, schematic: 'old-art' }))).toBe('octavia-a5')
  expect(autoSchematic(car('Skoda', 'Octavia', { year: 2011, schematic: 'none' }))).toBe('octavia-a5')
})

const custom = (id: string, group: CatalogItem['group'], name = 'Своё'): CatalogItem => ({
  id,
  name,
  group,
  builtin: false,
  createdAt: 1,
  updatedAt: 1,
})
const catalog = [
  ...BUILTIN_CATALOG,
  custom('u1', 'transmission'),
  custom('u2', 'body'),
  custom('u3', 'fluids'),
]

test('узлы, которых не видно снаружи, — в своих зонах', () => {
  expect(zoneOfItem(C.timingBelt, catalog)).toBe('timing')
  expect(zoneOfItem(C.timingChain, catalog)).toBe('timing')
  expect(zoneOfItem(C.waterPump, catalog)).toBe('timing')
  expect(zoneOfItem(C.brakeFluid, catalog)).toBe('brakes')
  expect(zoneOfItem(C.coolant, catalog)).toBe('cooling')
  expect(zoneOfItem(C.battery, catalog)).toBe('battery')
  expect(zoneOfItem(C.mtf, catalog)).toBe('transmission')
  expect(zoneOfItem(C.cabinFilter, catalog)).toBe('cabin')
  expect(zoneOfItem(C.acService, catalog)).toBe('cabin')
})

test('масло и фильтры — двигатель, колодки — своё колесо, шины и подвеска — переднее', () => {
  expect(zoneOfItem(C.engineOil, catalog)).toBe('engine')
  expect(zoneOfItem(C.airFilter, catalog)).toBe('engine')
  expect(zoneOfItem(C.sparkPlugs, catalog)).toBe('engine')
  expect(zoneOfItem(C.brakePadsFront, catalog)).toBe('wheelFront')
  expect(zoneOfItem(C.brakeDiscsRear, catalog)).toBe('wheelRear')
  expect(zoneOfItem(C.tiresWinter, catalog)).toBe('wheelFront')
  expect(zoneOfItem(C.shockAbsorbers, catalog)).toBe('wheelFront')
  expect(zoneOfItem(C.bulbs, catalog)).toBe('lights')
})

test('расширенный каталог: задняя ось — заднее колесо, фары — свет, охлаждение и тормозная система — свои зоны', () => {
  for (const id of [
    C.rearControlArms,
    C.rearArmBushings,
    C.rearBeamBushings,
    C.shockAbsorbersRear,
    C.rearShockMounts,
    C.coilSpringsRear,
    C.hubBearingRear,
    C.brakeCaliperRear,
    C.brakeDrumsRear,
    C.wheelCylindersRear,
    C.parkingBrakeCable,
  ])
    expect(zoneOfItem(id, catalog), id).toBe('wheelRear')
  for (const id of [
    C.headlights,
    C.fogLights,
    C.tailLights,
    C.lowBeamBulbs,
    C.highBeamBulbs,
    C.headlightPolishing,
  ])
    expect(zoneOfItem(id, catalog), id).toBe('lights')
  for (const id of [C.radiator, C.radiatorFan, C.coolantHoses, C.thermostat, C.acCondenser])
    expect(zoneOfItem(id, catalog), id).toBe('cooling')
  for (const id of [C.brakeMasterCylinder, C.brakeBooster, C.brakeHoses, C.brakeLines])
    expect(zoneOfItem(id, catalog), id).toBe('brakes')
  expect(zoneOfItem(C.windshield, catalog)).toBe('cabin')
  expect(zoneOfItem(C.wiperLinkage, catalog)).toBe('cabin')
  expect(zoneOfItem(C.frontLowerArm, catalog)).toBe('wheelFront')
  expect(zoneOfItem(C.brakeCaliperFront, catalog)).toBe('wheelFront')
})

test('левые и правые детали и свои узлы: «задн» в названии — заднее колесо, фары и фонари — свет', () => {
  for (const id of [
    C.shockRearLeft,
    C.shockRearRight,
    C.rearTrailingArmLeft,
    C.rearLateralArmRight,
    C.stabilizerLinkRearLeft,
    C.brakeCaliperRearLeft,
    C.absSensorRearRight,
    C.parkingBrakeCableLeft,
    C.drumBrakeShoes,
  ])
    expect(zoneOfItem(id, catalog), id).toBe('wheelRear')
  for (const id of [C.headlightLeft, C.tailLightRight, C.fogLightLeft])
    expect(zoneOfItem(id, catalog), id).toBe('lights')
  expect(zoneOfItem(C.frontLowerArmLeft, catalog)).toBe('wheelFront')
  expect(zoneOfItem(C.brakeCaliperFrontRight, catalog)).toBe('wheelFront')
  expect(zoneOfItem(C.drainPlugWasher, catalog)).toBe('engine')
  const own = [
    ...catalog,
    custom('u9', 'suspension', 'Сайлентблок задний'),
    custom('u10', 'electrical', 'Лампа стоп-сигнала'),
  ]
  expect(zoneOfItem('u9', own)).toBe('wheelRear')
  expect(zoneOfItem('u10', own)).toBe('lights')
})

test('свои узлы — по группе; кузов, «Прочее» и неизвестное — без зоны', () => {
  expect(zoneOfItem('u1', catalog)).toBe('transmission')
  expect(zoneOfItem('u3', catalog)).toBe('engine')
  expect(zoneOfItem('u2', catalog)).toBeNull()
  expect(zoneOfItem(C.other, catalog)).toBeNull()
  expect(zoneOfItem('нет', catalog)).toBeNull()
})

const status = (
  s: Partial<ReminderStatus> & Pick<ReminderStatus, 'ruleId' | 'state' | 'title'>,
): ReminderStatus => ({
  vehicleId: 'v1',
  ...s,
})

test('в зоне — самое срочное; просроченное раньше «скоро»; выносок — первые две зоны', () => {
  const data = schematicData(
    [
      status({
        ruleId: 'r1',
        itemId: C.timingBelt,
        title: 'Ремень ГРМ с роликами',
        state: 'soon',
        remainingKm: 2000,
        progressKm: 0.97,
      }),
      status({
        ruleId: 'r2',
        itemId: C.airFilter,
        title: 'Воздушный фильтр',
        state: 'soon',
        remainingKm: 800,
        progressKm: 0.96,
      }),
      status({
        ruleId: 'r3',
        itemId: C.engineOil,
        title: 'Моторное масло',
        state: 'overdue',
        remainingKm: -300,
        progressKm: 1.03,
      }),
      status({
        ruleId: 'r4',
        itemId: C.brakeFluid,
        title: 'Тормозная жидкость',
        state: 'soon',
        remainingDays: 20,
        progressTime: 0.97,
      }),
      status({
        ruleId: 'r5',
        itemId: C.cabinFilter,
        title: 'Салонный фильтр',
        state: 'ok',
        remainingKm: 9000,
      }),
      status({ ruleId: 'r6', itemId: C.bulbs, title: 'Лампы', state: 'unknown' }),
    ],
    catalog,
  )
  expect(data.marks).toEqual([
    { zone: 'engine', state: 'overdue', title: 'Масло', detail: `просрочено на 300\u00A0км · ещё 1` },
    { zone: 'timing', state: 'soon', title: 'Ремень ГРМ', detail: `через 2\u00A0000\u00A0км` },
    { zone: 'brakes', state: 'soon' },
  ])
  expect(data.counts).toEqual({ overdue: 1, soon: 3, ok: 1 })
  expect(data.label).toBe(
    'Схема машины: просрочено — Моторное масло; скоро — Ремень ГРМ с роликами, Воздушный фильтр, Тормозная жидкость',
  )
})

test('срок — тот, что дал состояние, даже если по другому пройдено больше', () => {
  const data = schematicData(
    [
      status({
        ruleId: 'r1',
        itemId: C.engineOil,
        title: 'Моторное масло',
        state: 'soon',
        remainingKm: 900,
        progressKm: 0.82,
        stateKm: 'soon',
        remainingDays: 31,
        progressTime: 0.83,
        stateTime: 'ok',
      }),
    ],
    catalog,
  )
  expect(data.marks[0]?.detail).toBe('через 900 км')
})

test('срок — по тому, что ближе: км или время; своё название напоминания не сокращается', () => {
  const data = schematicData(
    [
      status({
        ruleId: 'r1',
        itemId: C.brakeFluid,
        title: 'Тормозуха DOT 4',
        state: 'overdue',
        remainingKm: 5000,
        progressKm: 0.5,
        remainingDays: -40,
        progressTime: 1.05,
      }),
    ],
    catalog,
  )
  expect(data.marks[0]).toEqual({
    zone: 'brakes',
    state: 'overdue',
    title: 'Тормозуха DOT 4',
    detail: 'просрочено на 40\u00A0дней',
  })
})

test('проблема без зоны на чертеже — только в счётчике и имени; узлы в порядке — так и сказано', () => {
  const noZone = schematicData(
    [status({ ruleId: 'r1', title: 'Мойка днища', state: 'soon', remainingDays: 5 })],
    catalog,
  )
  expect(noZone.marks).toEqual([])
  expect(noZone.counts.soon).toBe(1)
  expect(noZone.label).toBe('Схема машины: скоро — Мойка днища')

  const fine = schematicData(
    [status({ ruleId: 'r1', itemId: C.engineOil, title: 'Моторное масло', state: 'ok' })],
    catalog,
  )
  expect(fine.label).toBe('Схема машины: узлы в порядке')
  expect(schematicData([], catalog).label).toBe('Схема машины')
})
