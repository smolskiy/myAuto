import { expect, test } from 'vitest'
import { BUILTIN_CATALOG, CATALOG_ID, ITEM_GROUP_LABELS, STARTER_REMINDER_ITEM_IDS } from './catalog'
import type { ItemGroup } from './types'

/** Как ищет выбор узла: регистр и ё/е не важны, подстрока. */
const norm = (s: string) => s.trim().toLowerCase().replaceAll('ё', 'е')
const byId = new Map(BUILTIN_CATALOG.map((i) => [i.id, i]))

test('каталог: стабильные уникальные id и нулевое время', () => {
  const ids = BUILTIN_CATALOG.map((i) => i.id)
  expect(new Set(ids).size).toBe(ids.length)
  expect(BUILTIN_CATALOG.length).toBeGreaterThanOrEqual(35)
  for (const i of BUILTIN_CATALOG) {
    expect(i.id).toMatch(/^item\.[a-z0-9_]+$/)
    expect(i.builtin).toBe(true)
    expect(i.updatedAt).toBe(0)
    expect(i.createdAt).toBe(0)
    expect(ITEM_GROUP_LABELS[i.group]).toBeTruthy()
  }
})

test('ключевые позиции и интервалы', () => {
  expect(byId.get(CATALOG_ID.engineOil)).toMatchObject({
    name: 'Моторное масло',
    defaultIntervalKm: 10000,
    defaultIntervalMonths: 12,
  })
  expect(byId.get(CATALOG_ID.oilFilter)).toMatchObject({
    defaultIntervalKm: 10000,
    defaultIntervalMonths: 12,
  })
  expect(byId.get(CATALOG_ID.brakeFluid)).toMatchObject({ defaultIntervalMonths: 24 })
  for (const id of STARTER_REMINDER_ITEM_IDS) expect(byId.has(id)).toBe(true)
})

/** Каталог первой версии: на эти id ссылаются записи владельца — ни id, ни название, ни интервал не меняются. */
const V1_ITEMS: [id: string, name: string, group: ItemGroup, km?: number, months?: number][] = [
  ['item.engine_oil', 'Моторное масло', 'engine', 10000, 12],
  ['item.oil_filter', 'Масляный фильтр', 'filters', 10000, 12],
  ['item.air_filter', 'Воздушный фильтр', 'filters', 20000, 24],
  ['item.cabin_filter', 'Салонный фильтр', 'filters', 15000, 12],
  ['item.fuel_filter', 'Топливный фильтр', 'filters', 40000, 48],
  ['item.spark_plugs', 'Свечи зажигания', 'ignition', 30000, 36],
  ['item.glow_plugs', 'Свечи накаливания', 'ignition', 60000],
  ['item.ignition_coil', 'Катушка зажигания', 'ignition'],
  ['item.timing_belt', 'Ремень ГРМ с роликами', 'timing', 60000, 60],
  ['item.timing_chain', 'Цепь ГРМ', 'timing', 150000],
  ['item.drive_belt', 'Приводной ремень', 'timing', 60000, 48],
  ['item.water_pump', 'Помпа', 'engine', 60000],
  ['item.coolant', 'Охлаждающая жидкость', 'fluids', 60000, 48],
  ['item.brake_fluid', 'Тормозная жидкость', 'fluids', undefined, 24],
  ['item.atf', 'Масло АКПП/вариатора', 'transmission', 60000],
  ['item.mtf', 'Масло МКПП', 'transmission', 90000],
  ['item.transfer_case_oil', 'Масло раздаточной коробки', 'transmission', 60000],
  ['item.diff_oil', 'Масло редуктора', 'transmission', 60000],
  ['item.power_steering_fluid', 'Жидкость ГУР', 'steering', 60000, 48],
  ['item.clutch', 'Сцепление', 'transmission'],
  ['item.brake_pads_front', 'Колодки тормозные передние', 'brakes', 30000],
  ['item.brake_pads_rear', 'Колодки тормозные задние', 'brakes', 50000],
  ['item.brake_discs_front', 'Диски тормозные передние', 'brakes', 80000],
  ['item.brake_discs_rear', 'Диски тормозные задние', 'brakes', 100000],
  ['item.shock_absorbers', 'Амортизаторы', 'suspension', 80000],
  ['item.suspension_check', 'Диагностика подвески', 'suspension', 15000, 12],
  ['item.wheel_alignment', 'Развал-схождение', 'suspension', 20000, 12],
  ['item.stabilizer_links', 'Стойки стабилизатора', 'suspension'],
  ['item.cv_boots', 'Пыльники ШРУС', 'suspension'],
  ['item.battery', 'Аккумулятор', 'electrical', undefined, 48],
  ['item.bulbs', 'Лампы', 'electrical'],
  ['item.wiper_blades', 'Щётки стеклоочистителя', 'body', undefined, 12],
  ['item.ac_service', 'Обслуживание кондиционера', 'climate', undefined, 24],
  ['item.tires_summer', 'Шины летние', 'tires'],
  ['item.tires_winter', 'Шины зимние', 'tires'],
  ['item.tire_fitting', 'Шиномонтаж', 'tires', undefined, 6],
  ['item.washer_fluid', 'Омывающая жидкость', 'fluids'],
  ['item.other', 'Прочее', 'other'],
]

test('позиции первой версии на месте: те же id, названия, группы и интервалы, тот же порядок', () => {
  expect(V1_ITEMS).toHaveLength(38)
  expect(BUILTIN_CATALOG.slice(0, V1_ITEMS.length).map((i) => i.id)).toEqual(V1_ITEMS.map(([id]) => id))
  for (const [id, name, group, km, months] of V1_ITEMS) {
    const item = byId.get(id)
    expect(item, id).toBeDefined()
    expect(item?.name, id).toBe(name)
    expect(item?.group, id).toBe(group)
    expect(item?.defaultIntervalKm, id).toBe(km)
    expect(item?.defaultIntervalMonths, id).toBe(months)
  }
})

test('стартовые напоминания не меняются', () => {
  expect(STARTER_REMINDER_ITEM_IDS).toEqual([
    'item.engine_oil',
    'item.oil_filter',
    'item.air_filter',
    'item.cabin_filter',
    'item.spark_plugs',
    'item.brake_fluid',
    'item.coolant',
    'item.timing_belt',
  ])
})

test('названия уникальны без учёта регистра и ё/е, без лишних пробелов, с заглавной буквы', () => {
  const names = BUILTIN_CATALOG.map((i) => norm(i.name))
  const dupes = names.filter((n, idx) => names.indexOf(n) !== idx)
  expect(dupes).toEqual([])
  for (const i of BUILTIN_CATALOG) {
    expect(i.name, i.id).toBe(i.name.trim())
    expect(i.name, i.id).not.toMatch(/\s{2}/)
    expect(i.name[0], i.id).toBe(i.name[0]?.toUpperCase())
  }
})

test('CATALOG_ID и каталог совпадают один к одному', () => {
  const ids = Object.values(CATALOG_ID) as string[]
  expect(new Set(ids).size).toBe(ids.length)
  for (const id of ids) expect(byId.has(id), id).toBe(true)
  expect([...byId.keys()].sort()).toEqual([...ids].sort())
})

test('интервалы по умолчанию — целые положительные км (кратно 1000) и месяцы', () => {
  for (const i of BUILTIN_CATALOG) {
    if (i.defaultIntervalKm !== undefined) {
      expect(Number.isInteger(i.defaultIntervalKm / 1000), i.id).toBe(true)
      expect(i.defaultIntervalKm, i.id).toBeGreaterThan(0)
    }
    if (i.defaultIntervalMonths !== undefined) {
      expect(Number.isInteger(i.defaultIntervalMonths), i.id).toBe(true)
      expect(i.defaultIntervalMonths, i.id).toBeGreaterThan(0)
    }
  }
})

test('каталог покрывает основные узлы легковой машины: 110–160 позиций', () => {
  expect(BUILTIN_CATALOG.length).toBeGreaterThanOrEqual(110)
  expect(BUILTIN_CATALOG.length).toBeLessThanOrEqual(160)
})

test.each([
  'Рычаг',
  'Сайлентблок',
  'Шаровая',
  'ступиц',
  'Суппорт',
  'Рулевая тяга',
  'Рулевой наконечник',
  'Рулевая рейка',
  'Стойки амортизаторов',
  'Амортизаторы задние',
  'Опоры передних стоек',
  'Пружины',
  'Втулки стабилизатора',
  'Отбойник',
  'Тормозные шланги',
  'Трос стояночного',
  'Барабан',
  'ШРУС наружный',
  'ШРУС внутренний',
  'полуось',
  'Выжимной подшипник',
  'Маховик',
  'Опоры двигателя',
  'Опора КПП',
  'Прокладка клапанной крышки',
  'Термостат',
  'Радиатор охлаждения',
  'лямбда',
  'Датчик коленвала',
  'Форсунки',
  'Дроссельная заслонка',
  'Катализатор',
  'Глушитель',
  'Гофра',
  'Генератор',
  'Стартер',
  'Лампы ближнего света',
  'Фары',
  'Радиатор печки',
  'Компрессор кондиционера',
  'Лобовое стекло',
  'Балансировка',
  'Диски колесные',
  'Диагностика двигателя',
  'Мойка',
  'Химчистка',
])('поиск «%s» находит узел в каталоге', (query) => {
  expect(BUILTIN_CATALOG.some((i) => norm(i.name).includes(norm(query)))).toBe(true)
})

/** Новые позиции с осью в названии: id стабильны навсегда, по ним чертёж раскладывает узлы по колёсам. */
test.each<[id: string, name: string, group: ItemGroup]>([
  ['item.front_lower_arm', 'Рычаг передний нижний', 'suspension'],
  ['item.front_upper_arm', 'Рычаг передний верхний', 'suspension'],
  ['item.rear_control_arms', 'Рычаги задней подвески', 'suspension'],
  ['item.front_arm_bushings', 'Сайлентблоки передних рычагов', 'suspension'],
  ['item.rear_arm_bushings', 'Сайлентблоки задних рычагов', 'suspension'],
  ['item.front_struts', 'Стойки амортизаторов передние', 'suspension'],
  ['item.shock_absorbers_rear', 'Амортизаторы задние', 'suspension'],
  ['item.front_strut_mounts', 'Опоры передних стоек', 'suspension'],
  ['item.coil_springs_front', 'Пружины подвески передние', 'suspension'],
  ['item.coil_springs_rear', 'Пружины подвески задние', 'suspension'],
  ['item.hub_bearing_front', 'Подшипник ступицы передний', 'suspension'],
  ['item.hub_bearing_rear', 'Подшипник ступицы задний', 'suspension'],
  ['item.brake_caliper_front', 'Суппорт тормозной передний', 'brakes'],
  ['item.brake_caliper_rear', 'Суппорт тормозной задний', 'brakes'],
  ['item.brake_drums_rear', 'Барабаны тормозные задние', 'brakes'],
])('позиция %s — «%s»', (id, name, group) => {
  expect(byId.get(id)).toMatchObject({ name, group })
})
