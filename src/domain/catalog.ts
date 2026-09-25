import type { CatalogItem, ID, ItemGroup } from './types'

/** Стабильные id встроенных позиций — для ссылок из кода. Менять нельзя: на них ссылаются записи пользователя. */
export const CATALOG_ID = {
  engineOil: 'item.engine_oil',
  oilFilter: 'item.oil_filter',
  airFilter: 'item.air_filter',
  cabinFilter: 'item.cabin_filter',
  fuelFilter: 'item.fuel_filter',
  sparkPlugs: 'item.spark_plugs',
  glowPlugs: 'item.glow_plugs',
  ignitionCoil: 'item.ignition_coil',
  timingBelt: 'item.timing_belt',
  timingChain: 'item.timing_chain',
  driveBelt: 'item.drive_belt',
  waterPump: 'item.water_pump',
  coolant: 'item.coolant',
  brakeFluid: 'item.brake_fluid',
  atf: 'item.atf',
  mtf: 'item.mtf',
  transferCaseOil: 'item.transfer_case_oil',
  diffOil: 'item.diff_oil',
  powerSteeringFluid: 'item.power_steering_fluid',
  clutch: 'item.clutch',
  brakePadsFront: 'item.brake_pads_front',
  brakePadsRear: 'item.brake_pads_rear',
  brakeDiscsFront: 'item.brake_discs_front',
  brakeDiscsRear: 'item.brake_discs_rear',
  shockAbsorbers: 'item.shock_absorbers',
  suspensionCheck: 'item.suspension_check',
  wheelAlignment: 'item.wheel_alignment',
  stabilizerLinks: 'item.stabilizer_links',
  cvBoots: 'item.cv_boots',
  battery: 'item.battery',
  bulbs: 'item.bulbs',
  wiperBlades: 'item.wiper_blades',
  acService: 'item.ac_service',
  tiresSummer: 'item.tires_summer',
  tiresWinter: 'item.tires_winter',
  tireFitting: 'item.tire_fitting',
  washerFluid: 'item.washer_fluid',
  other: 'item.other',
} as const satisfies Record<string, ID>

export const ITEM_GROUP_LABELS: Record<ItemGroup, string> = {
  engine: 'Двигатель',
  fluids: 'Жидкости',
  filters: 'Фильтры',
  ignition: 'Зажигание',
  timing: 'ГРМ и ремни',
  transmission: 'Трансмиссия',
  brakes: 'Тормоза',
  suspension: 'Подвеска',
  steering: 'Рулевое управление',
  electrical: 'Электрика',
  climate: 'Климат',
  body: 'Кузов',
  tires: 'Шины',
  other: 'Прочее',
}

function item(id: ID, name: string, group: ItemGroup, km?: number, months?: number): CatalogItem {
  return {
    id, name, group, builtin: true, createdAt: 0, updatedAt: 0,
    ...(km !== undefined && { defaultIntervalKm: km }),
    ...(months !== undefined && { defaultIntervalMonths: months }),
  }
}

const C = CATALOG_ID

/** Встроенный каталог узлов. `createdAt/updatedAt = 0`: любая правка пользователя побеждает при слиянии. */
export const BUILTIN_CATALOG: CatalogItem[] = [
  item(C.engineOil, 'Моторное масло', 'engine', 10000, 12),
  item(C.oilFilter, 'Масляный фильтр', 'filters', 10000, 12),
  item(C.airFilter, 'Воздушный фильтр', 'filters', 20000, 24),
  item(C.cabinFilter, 'Салонный фильтр', 'filters', 15000, 12),
  item(C.fuelFilter, 'Топливный фильтр', 'filters', 40000, 48),
  item(C.sparkPlugs, 'Свечи зажигания', 'ignition', 30000, 36),
  item(C.glowPlugs, 'Свечи накаливания', 'ignition', 60000),
  item(C.ignitionCoil, 'Катушка зажигания', 'ignition'),
  item(C.timingBelt, 'Ремень ГРМ с роликами', 'timing', 60000, 60),
  item(C.timingChain, 'Цепь ГРМ', 'timing', 150000),
  item(C.driveBelt, 'Приводной ремень', 'timing', 60000, 48),
  item(C.waterPump, 'Помпа', 'engine', 60000),
  item(C.coolant, 'Охлаждающая жидкость', 'fluids', 60000, 48),
  item(C.brakeFluid, 'Тормозная жидкость', 'fluids', undefined, 24),
  item(C.atf, 'Масло АКПП/вариатора', 'transmission', 60000),
  item(C.mtf, 'Масло МКПП', 'transmission', 90000),
  item(C.transferCaseOil, 'Масло раздаточной коробки', 'transmission', 60000),
  item(C.diffOil, 'Масло редуктора', 'transmission', 60000),
  item(C.powerSteeringFluid, 'Жидкость ГУР', 'steering', 60000, 48),
  item(C.clutch, 'Сцепление', 'transmission'),
  item(C.brakePadsFront, 'Колодки тормозные передние', 'brakes', 30000),
  item(C.brakePadsRear, 'Колодки тормозные задние', 'brakes', 50000),
  item(C.brakeDiscsFront, 'Диски тормозные передние', 'brakes', 80000),
  item(C.brakeDiscsRear, 'Диски тормозные задние', 'brakes', 100000),
  item(C.shockAbsorbers, 'Амортизаторы', 'suspension', 80000),
  item(C.suspensionCheck, 'Диагностика подвески', 'suspension', 15000, 12),
  item(C.wheelAlignment, 'Развал-схождение', 'suspension', 20000, 12),
  item(C.stabilizerLinks, 'Стойки стабилизатора', 'suspension'),
  item(C.cvBoots, 'Пыльники ШРУС', 'suspension'),
  item(C.battery, 'Аккумулятор', 'electrical', undefined, 48),
  item(C.bulbs, 'Лампы', 'electrical'),
  item(C.wiperBlades, 'Щётки стеклоочистителя', 'body', undefined, 12),
  item(C.acService, 'Обслуживание кондиционера', 'climate', undefined, 24),
  item(C.tiresSummer, 'Шины летние', 'tires'),
  item(C.tiresWinter, 'Шины зимние', 'tires'),
  item(C.tireFitting, 'Шиномонтаж', 'tires', undefined, 6),
  item(C.washerFluid, 'Омывающая жидкость', 'fluids'),
  item(C.other, 'Прочее', 'other'),
]

/** Позиции, для которых мастер новой машины предлагает включить напоминания. */
export const STARTER_REMINDER_ITEM_IDS: ID[] = [
  C.engineOil, C.oilFilter, C.airFilter, C.cabinFilter, C.sparkPlugs, C.brakeFluid, C.coolant, C.timingBelt,
]
